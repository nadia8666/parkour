using Godot;
using Parkour.Lib;

namespace Parkour.Actor.Parkour;

public partial class ActorParkour
{
    // friction
    public const float SlideDragFactor = 2;
    public const float SlideFrictionWindow = 0.2F; // s before friction applies

    // slopes
    public const float SlideSlopeSpeed = 2.5f;
    public const float SlideMinSpeed = 8 * Actor3D.Unit;
    public const float SlideCooldown = 1;
    public const float SlideMinDuration = 0.5F;
    public double lastSlide = 0;
    public Vector3 slideStoredVelocity = new();
    public float slideEntrySpeed = 0;
    public bool sliding = false;

    public void Powerslide()
    {
        SetActive("Powerslide");

        if (VUtil.WithY(actor.Velocity, 0).LengthSquared() <= 0)
            actor.Velocity = VUtil.WithY(actor.camera.RawLookFlat * SlideMinSpeed, actor.Velocity.Y);

        float forceMultiplier = (float)(1 + (0.5 * Mathf.Clamp((Actor3D.Clock() - lastSlide - 1 / 30) * 2, 0, 1)));

        lastSlide = Actor3D.Clock();
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
        double duration = Actor3D.Clock() - lastSlide;
        float slopeDot = 1;
        Vector3 vel = actor.Velocity;

        // TODO: slide under checks
        if (actor.Grounded)
        {
            Vector3 normal = actor.ground.Normal;
            float normalDotUp = Mathf.Clamp(normal.Dot(Vector3.Up), -1, 1);
            float slopeAngle = Mathf.Acos(normalDotUp);
            slopeDot = Mathf.Max(normalDotUp, 0);

            Vector3 downhill = Vector3.Down - normal * Vector3.Down.Dot(normal);
            if (downhill.LengthSquared() > 0.000001f)
            {
                float slopeAcceleration = Mathf.Sin(slopeAngle) * actor.physics.gravity * SlideSlopeSpeed;
                vel += downhill.Normalized() * slopeAcceleration * delta;
            }
        }

        // friction
        if (duration > SlideFrictionWindow)
            vel /= 1 + SlideDragFactor * delta * (slopeDot < .95f ? 0 : 1);

        actor.Velocity = vel;

        Vector3 flatVelocity = VUtil.WithY(actor.Velocity, 0);
        if (flatVelocity.LengthSquared() > 0)
            RotateTowardVector(flatVelocity, Mathf.Min(15 * delta, 1));

        bool forceCancel = duration > SlideMinDuration && (!actor.InCoyote || !actor.downmove.isDown);
        bool tooSlow = vel.Length() <= SlideMinSpeed && slopeDot >= .95f;
        if (forceCancel || tooSlow) { EndSlide(); return; }
    }

    private void EndSlide()
    {
        if (!sliding) return;
        SetActive();
        sliding = false;
        slideStoredVelocity = Vector3.Zero;
    }

    public void RotateTowardVector(Vector3 vector, float lerpForce)
    {
        float yRot = Basis.LookingAt(vector).GetEuler().Y;
        actor.Rotation = VUtil.WithY(actor.Rotation, Mathf.LerpAngle(actor.Rotation.Y, yRot, lerpForce));
    }

    public bool TryPowerslide()
    {
        if (actor.Velocity.Length() < SlideMinSpeed || Actor3D.Clock() - lastSlide <= SlideCooldown || Parkouring) return false;

        Powerslide();

        return true;
    }
}