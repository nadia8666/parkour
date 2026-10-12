using System;
using Godot;
using Parkour.Lib;

namespace Parkour.Actor.Parkour;

public partial class ActorParkour
{
    public const float LedgeGrabMaxHeight = 1.4f; // vertical distance checked
    public const float LedgeGrabDistance = 1.25f; // horizontal distance checked
    public const float LedgeVaultHeight = 2.8f;

    public const float LedgeBlend = 0.1f;
    public const float LedgeGrabWarpTime = 0.125f;
    public const float LedgeFacingRate = 30f;

    public struct LedgeGrabData(Vector3 position, Vector3 normal, bool thin)
    {
        public Vector3 position = position;
        public Vector3 normal = normal;
        public bool thin = thin;
    }

    public LedgeGrabData? currentLedgeGrab;
    public bool ledgeGrabbing = false;
    public bool ledgeVaulting = false;
    public float ledgeGrabProgress = 0;
    public float ledgeVaultProgress = 0;
    public bool checkedLedgeVault = false;

    private bool ledgeMotionActive = false;
    private bool vaultBlendDone = false;
    private Basis ledgeBasis = Basis.Identity;
    private Quaternion ledgeFacing = Quaternion.Identity;
    private Vector3 ledgeWarp = Vector3.Zero;
    private float ledgeWarpDuration = 1;
    private float ledgeWarpElapsed = 0;
    private float ledgeWarpAlpha = 0;

    private static Quaternion LedgeFacingOf(Vector3 normal) => Basis.LookingAt(-normal).GetRotationQuaternion().Normalized();

    private Vector3 RootToWorld(Basis basis, Vector3 root) => basis * (actor.animation.RootSpace * root);

    // warp? tween? consistency is Great.
    private void BeginLedgeWarp(Vector3 total, float duration)
    {
        ledgeWarp = total;
        ledgeWarpDuration = Mathf.Max(duration, 0.001f);
        ledgeWarpElapsed = 0;
        ledgeWarpAlpha = 0;
    }


    public LedgeGrabData? GetLedgeGrabData(Vector3 center)
    {
        if (actor.Velocity.Y <= -15) return null;

        Vector3 target = ledgeGrabbing ? actor.LookFlat : actor.GenericTarget;

        RaycastResults? lastCast = null;

        for (float heightStep = 1; heightStep <= 50; heightStep++)
        {
            float targetHeight = LedgeGrabMaxHeight * (heightStep / 50);

            Vector3 frontOrigin = center + Vector3.Up * targetHeight;
            RaycastResults? frontCast = Raycast.Cast(frontOrigin, frontOrigin + target * LedgeGrabDistance, actor.CollisionMask, actor.ground.excludeList);
            if (frontCast is RaycastResults front)
                lastCast = front;
            else
            {
                if (lastCast is RaycastResults last && Mathf.Abs(last.normal.Y) <= .25)
                {
                    for (float dist = 1; dist <= 20; dist++)
                    {
                        float distAlpha = LedgeGrabDistance * (dist / 20);
                        Vector3 downOrigin = last.position + Vector3.Up * (LedgeGrabMaxHeight * 0.02f) + actor.GenericTarget * distAlpha;
                        RaycastResults? downCast = Raycast.Cast(downOrigin, downOrigin + Vector3.Down * 0.04f, actor.CollisionMask, actor.ground.excludeList);

                        if (downCast is RaycastResults down)
                            return new LedgeGrabData(
                                 position: last.position.WithY(down.position.Y),
                                 normal: last.normal.WithY(0).Normalized(),
                                 thin: false
                            );
                    }
                }
            }
        }

        return null;
    }

    public void StartLedgeGrab(LedgeGrabData data)
    {
        bool fromVault = ledgeVaulting;

        ledgeGrabbing = true;
        SetActive("ledgeGrab");
        actor.Freeze("ledgeGrab");

        actor.animation.Play("ledge_grab", fromVault ? 0f : 0.1f);
        actor.animation.Stop("ledge_vault", fromVault ? LedgeBlend : 0f);

        currentLedgeGrab = data;
        ledgeGrabProgress = 0;
        checkedLedgeVault = false;

        ledgeFacing = LedgeFacingOf(data.normal);
        ledgeBasis = new Basis(ledgeFacing);

        Vector3 hang = RootToWorld(ledgeBasis, actor.animation.SampleRoot("ledge_grab", 0));
        BeginLedgeWarp(data.position + hang - actor.Position, LedgeGrabWarpTime);
        ledgeMotionActive = true;

        actor.sound.grab.Play();
    }

    public void EndLedgeGrab()
    {
        ledgeGrabbing = false;
        SetActive();
        actor.Unfreeze("ledgeGrab");
        actor.Velocity = actor.Velocity.WithY(0).LimitLength(Actor3D.BaseMomentum);
        actor.UpdateGrounded();
        actor.input.ConsumeAll();
    }

    public void StepLedgeGrab(float delta)
    {
        ledgeGrabProgress = ledgeGrabProgress = actor.animation.Progress("ledge_grab");

        if (ledgeGrabProgress >= 0.25 && !checkedLedgeVault)
            TryLedgeVault();

        if (ledgeGrabbing && actor.animation.WillFinish("ledge_grab", delta))
            EndLedgeGrab();
    }

    public void StepLedgeVault(float delta)
    {
        ledgeVaultProgress = actor.animation.Progress("ledge_vault");

        if (!vaultBlendDone && actor.animation.Elapsed("ledge_vault") >= LedgeBlend)
        {
            vaultBlendDone = true;
            actor.animation.Stop("ledge_grab", 0f);
        }

        if (actor.animation.WillFinish("ledge_vault", delta))
        {
            checkedLedgeVault = false;
            StartLedgeGrab(currentLedgeGrab.Value);
            ledgeVaulting = false;
        }
    }

    public void StepLedgeMotion(float delta)
    {
        if (!ledgeMotionActive) return;

        ledgeWarpElapsed = Mathf.Min(ledgeWarpElapsed + delta, ledgeWarpDuration);
        float t = ledgeWarpElapsed / ledgeWarpDuration;
        float alpha = t * t * (3f - 2f * t);

        actor.Position += RootToWorld(ledgeBasis, actor.animation.GetRootMotionPosition()) + ledgeWarp * (alpha - ledgeWarpAlpha);
        ledgeWarpAlpha = alpha;

        actor.Quaternion = actor.Quaternion.Slerp(ledgeFacing, 1f - Mathf.Exp(-LedgeFacingRate * delta)).Normalized();

        if (!ledgeGrabbing && !ledgeVaulting)
            ledgeMotionActive = false;
    }

    public void TryLedgeVault()
    {
        checkedLedgeVault = true;

        if (!actor.Upmove.isDown) return;

        Vector3 next = currentLedgeGrab.Value.position + new Vector3(0, LedgeVaultHeight, 0);

        // for the 2 raycasts the offsets matter less since we already know that its just 10 studs above the last valid corner pos 
        RaycastResults? downCast = Raycast.Cast(next + actor.LookFlat / 5 + Vector3.Up / 2, next + actor.LookFlat / 5 + Vector3.Down, actor.CollisionMask, actor.ground.excludeList);
        RaycastResults? frontCast = Raycast.Cast(next - actor.LookFlat / 2 + Vector3.Down / 4, next + actor.LookFlat / 2 + Vector3.Down / 4, actor.CollisionMask, actor.ground.excludeList);

        if (downCast is RaycastResults down && frontCast is RaycastResults front && Mathf.Abs(front.normal.Y) <= .25)
        {
            SetActive("ledgeVault");
            ledgeGrabbing = false;
            currentLedgeGrab = new LedgeGrabData(
                position: front.position.WithY(down.position.Y),
                normal: front.normal.WithY(0).Normalized(),
                thin: false
            );

            ledgeFacing = LedgeFacingOf(currentLedgeGrab.Value.normal);

            Vector3 travel = RootToWorld(ledgeBasis, actor.animation.SampleRoot("ledge_vault", actor.animation.ClipLength("ledge_vault")) - actor.animation.SampleRoot("ledge_vault", 0));
            Vector3 hang = RootToWorld(new Basis(ledgeFacing), actor.animation.SampleRoot("ledge_grab", 0));
            Vector3 pending = ledgeWarp * (1f - ledgeWarpAlpha);
            BeginLedgeWarp(currentLedgeGrab.Value.position + hang - actor.Position - pending - travel, actor.animation.Duration("ledge_vault"));


            ledgeVaultProgress = 0;
            ledgeVaulting = true;

            actor.animation.Play("ledge_vault", fadeIn: LedgeBlend);
        }
    }
}