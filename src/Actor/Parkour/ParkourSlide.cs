using System;
using Godot;
using Parkour.Lib;

namespace Parkour.Actor.Parkour;

public partial class ActorParkour
{
    public const float SlideFriction = 2;
    public const float SlideFrictionWindow = 0.2F; // s before friction applies
    public const float SlideMinSpeed = 8 * Actor3D.Unit;
    public const float SlideCooldown = 1;
    public const float SlideMinDuration = 0.5F;
    public double lastSlide = 0;
    public Vector3 slideStoredVelocity = new();
    public float slideEntrySpeed = 0;
    public bool sliding = false;

    public void Powerslide()
    {
        if (VUtil.WithY(actor.Velocity, 0).LengthSquared() <= 0)
            actor.Velocity = VUtil.WithY(actor.camera.RawLookFlat * SlideMinSpeed, actor.Velocity.Y);

        float forceMultiplier = (float)(1 + (0.5 * Mathf.Clamp((actor.Clock() - lastSlide - 1 / 30) * 2, 0, 1)));

        lastSlide = actor.Clock();
        slideEntrySpeed = actor.Velocity.Length();

        Vector3 newVelocity = actor.Velocity * forceMultiplier;

        actor.Velocity = newVelocity;
        slideStoredVelocity = newVelocity;

        sliding = true;
        RotateTowardVector(VUtil.WithY(newVelocity, 0).Normalized(), 1);
    
        actor.sound.slideStart.Play();
    }

    public void SlideStep(float delta)
    {
        double duration = actor.Clock() - lastSlide;
        if (duration > SlideFrictionWindow)
            actor.Velocity /= 1 + SlideFriction * delta;

        // TODO slide under checks

        Vector3 flatVelocity = VUtil.WithY(actor.Velocity, 0);
        if (flatVelocity.LengthSquared() > 0)
            RotateTowardVector(flatVelocity, Mathf.Min(15 * delta, 1));

        if ((duration > SlideMinDuration && (!actor.InCoyote || !actor.input.binds.downmove.isDown)) || flatVelocity.Length() <= SlideMinSpeed)
        {
            sliding = false;
            slideStoredVelocity = Vector3.Zero;
        }
    }

    public void RotateTowardVector(Vector3 vector, float lerpForce)
    {
        float yRot = Basis.LookingAt(vector).GetEuler().Y;
        actor.Rotation = VUtil.WithY(actor.Rotation, yRot);
    }

    public bool TryPowerslide()
    {
        if (actor.Velocity.Length() < SlideMinSpeed || actor.Clock() - lastSlide <= SlideCooldown) return false;

        Powerslide();

        return true;
    }
}