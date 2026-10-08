using Godot;
using Parkour.Lib;

namespace Parkour.Actor;

public class ActorPhysics(Actor3D actor)
{
    // world
    public const float DefaultGravity = 75f * Actor3D.Unit;
    public float gravity = DefaultGravity;
    public const float TerminalFall = 210f * Actor3D.Unit;
    public const float TerminalRise = 500f * Actor3D.Unit;
    public const float TerminalSpeed = 5000f * Actor3D.Unit;

    // drag
    public const float GroundDrag = 10f;
    public const float AirDrag = 0.1f;
    public const float LandingGrace = 0.1f;
    public const float LandingRamp = 0.1f;

    // steering
    public const float GroundSteer = 20f * 0.6f;
    public const float AirSteer = 20f * 0.25f;
    public const float OverspeedBand = 0.15f; // steering limiter at high speeds

    // friction
    public const float GroundFrictionStart = 24f * Actor3D.Unit;
    public const float GroundFrictionEnd = 200f * Actor3D.Unit;
    public const float GroundFrictionFalloff = 4.5f;

    public const float IdleSpeed = 0.05f;
    public const float TurnRate = 12.5f; // only applies in 3rd person

    // constructor
    private readonly Actor3D actor = actor;
    private float groundedTime;
    public float frictionScale = 1f;

    // physics
    public void StepPhysics(float delta)
    {
        bool hasInput = actor.input.stickL.Length() > ActorInput.InputDeadzone;
        Vector3 wish = hasInput ? actor.input.globalMoveVector.Normalized() : Vector3.Zero;
        bool grounded = actor.Grounded;
        bool sliding = actor.parkour.sliding;
        groundedTime = grounded ? groundedTime + delta : 0;

        UpdateFacing(delta, wish, hasInput);

        Vector3 velocity = actor.Velocity;
        Vector3 flat = StepHorizontal(VUtil.WithY(velocity, 0), wish, hasInput, grounded, delta);
        float y = StepVertical(velocity.Y, grounded, sliding, delta);

        actor.Velocity = new Vector3(flat.X, y, flat.Z);
        actor.ground.StickToSlopes(delta, sliding);
    }

    private float StepVertical(float y, bool grounded, bool sliding, float delta)
    {
        if (grounded && sliding)
            return y; // the slide step owns velocity on the ground

        if (grounded && y <= 0)
            return 0;

        return Mathf.Clamp(y - gravity * delta, -TerminalFall, TerminalRise);
    }

    private void UpdateFacing(float delta, Vector3 wish, bool hasInput)
    {
        if (actor.RotationLocked) return;

        if (actor.camera.Locked)
            actor.Rotation = new(actor.Rotation.X, actor.camera.rotation.Y, 0);
        else if (hasInput)
        {
            float rot = Basis.LookingAt(wish).GetEuler().Y;
            actor.Rotation = new(actor.Rotation.X, Mathf.LerpAngle(actor.Rotation.Y, rot, 1 - Mathf.Exp(-TurnRate * delta)), 0);
        }
    }

    private Vector3 StepHorizontal(Vector3 flat, Vector3 wish, bool hasInput, bool grounded, float delta)
    {
        if (actor.MovementLocked)
            return flat.LimitLength(TerminalSpeed);

        float walkSpeed = actor.momentum;
        float speed = flat.Length();
        float friction = GetFrictionAt(speed) * frictionScale;

        float steerControl = 1f;
        if (hasInput && speed > walkSpeed)
        {
            float across = Mathf.Clamp(1f - flat.Normalized().Dot(wish), 0f, 1f);
            float over = Mathf.Clamp((speed - walkSpeed) / (walkSpeed * OverspeedBand), 0f, 1f);
            steerControl = Mathf.Lerp(1f, across, over);
        }

        // drag, fades out while input steers
        float landed = Mathf.Clamp(Mathf.InverseLerp(LandingGrace, LandingGrace + LandingRamp, groundedTime), 0f, 1f);
        float drag = grounded ? GroundDrag * friction * landed : AirDrag;
        if (hasInput)
            drag *= 1f - steerControl;
        flat *= Mathf.Exp(-drag * delta);

        // steering
        if (hasInput)
        {
            float rate = (grounded ? GroundSteer : AirSteer) * friction * steerControl;
            flat = flat.Lerp(wish * walkSpeed, 1f - Mathf.Exp(-rate * delta));
        }
        else if (flat.LengthSquared() < IdleSpeed * IdleSpeed)
            flat = Vector3.Zero;

        return flat.LimitLength(TerminalSpeed);
    }

    private static float GetFrictionAt(float speed)
    {
        float t = Mathf.Clamp(Mathf.InverseLerp(GroundFrictionStart, GroundFrictionEnd, speed), 0f, 1f);
        return Mathf.Exp(-GroundFrictionFalloff * t);
    }
}