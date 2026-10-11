using System;
using Godot;
using Parkour.Lib;

namespace Parkour.Actor.Parkour;

public partial class ActorParkour
{
    public const float LedgeGrabMaxHeight = 1.4f; // vertical distance checked
    public const float LedgeGrabDistance = 1.25f; // horizontal distance checked
    public const float LedgeGrabDuration = 35f / 60f;

    public const float LedgeVaultDuration = 40f / 60f;
    public const float LedgeVaultHeight = 2.8f;

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
        ledgeGrabbing = true;
        SetActive("ledgeGrab");
        actor.Freeze("ledgeGrab");

        actor.animation.Play("ledge_grab", ledgeVaulting ? 0f : 0.1f);
        actor.animation.Stop("ledge_vault", 0f);

        currentLedgeGrab = data;
        ledgeGrabProgress = 0;
        checkedLedgeVault = false;

        if (ledgeVaulting)
        {
            actor.Position = data.position;
            actor.ResetPhysicsInterpolation();
        }
        else
            actor.TweenRootTo(data.position, 0.125f);

        actor.camera.RenderCamera();

        actor.Quaternion = Basis.LookingAt(-data.normal).GetRotationQuaternion().Normalized();

        actor.sound.grab.Play();
    }

    public void EndLedgeGrab()
    {
        ledgeGrabbing = false;
        SetActive();
        actor.Unfreeze("ledgeGrab");
        actor.Velocity = actor.Velocity.WithY(0).LimitLength(Actor3D.BaseMomentum);
        actor.UpdateGrounded();
    }

    public void StepLedgeGrab(float delta)
    {
        ledgeGrabProgress += delta / LedgeGrabDuration;

        if (ledgeGrabProgress >= 0.25 && !checkedLedgeVault)
            TryLedgeVault();

        if (ledgeGrabProgress >= 1)
            EndLedgeGrab();
    }

    public void StepLedgeVault(float delta)
    {
        ledgeVaultProgress += delta / LedgeVaultDuration;

        if (ledgeVaultProgress >= 1)
        {
            checkedLedgeVault = false;
            StartLedgeGrab(currentLedgeGrab.Value);
            ledgeVaulting = false;
        }
    }

    public void TryLedgeVault()
    {
        checkedLedgeVault = true;

        if (!actor.Upmove.isDown) return;

        Vector3 next = actor.Position + new Vector3(0, LedgeVaultHeight, 0);

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

            ledgeVaultProgress = 0;
            ledgeVaulting = true;

            actor.animation.Stop("ledge_grab", fadeOut: 0);
            actor.animation.Play("ledge_vault", fadeIn: 0);
        }
    }
}