using System;
using Godot;
using Parkour.Lib;

namespace Parkour.Actor.Parkour;

public partial class ActorParkour
{
    public const float LedgeGrabMaxHeight = 1.15f; // vertical distance checked
    public const float LedgeGrabDistance = 0.7f; // horizontal distance checked
    public const float LedgeGrabDuration = 35f / 60f;

    public struct LedgeGrabData(Vector3 position, Vector3 normal, bool thin)
    {
        public Vector3 position = position;
        public Vector3 normal = normal;
        public bool thin = thin;
    }

    public LedgeGrabData? currentLedgeGrab;
    public bool ledgeGrabbing = false;
    public float ledgeGrabProgress = 0;

    public LedgeGrabData? GetLedgeGrabData()
    {
        RaycastResults? lastCast = null;

        for (float heightStep = 1; heightStep <= 50; heightStep++)
        {
            float targetHeight = LedgeGrabMaxHeight * (heightStep / 50);

            Vector3 frontOrigin = actor.Center + Vector3.Up * targetHeight;
            RaycastResults? frontCast = Raycast.Cast(frontOrigin, frontOrigin + actor.GenericTarget * LedgeGrabDistance, actor.CollisionMask, actor.ground.excludeList);
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
                break;
            }
        }

        return null;
    }

    public void StartLedgeGrab(LedgeGrabData data)
    {
        ledgeGrabbing = true;
        SetActive("ledgeGrab");
        actor.Freeze("ledgeGrab");

        actor.animation.Play("ledge_grab");

        currentLedgeGrab = data;
        ledgeGrabProgress = 0;

        actor.TweenRootTo(data.position, 0.125f);
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

        if (ledgeGrabProgress >= 1)
            EndLedgeGrab();
    }
}