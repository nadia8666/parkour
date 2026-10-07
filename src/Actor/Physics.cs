using System;
using Godot;

namespace Parkour.Actor;

public class ActorPhysics
{
    // constants
    public const float Gravity = 21;
    public const float GroundDrag = 5f;//25;
    public const float AirDrag = 1.5f;

    // constructor
    private Actor3D actor;
    public ActorPhysics(Actor3D actor)
    {
        this.actor = actor;
    }

    // physics
    public void StepPhysics(float delta)
    {
        // vector editing
        Vector3 moveVector = actor.input.globalMoveVector;
        if (actor.camera.locked)
            actor.Rotation = new(actor.Rotation.X, actor.camera.rotation.Y, 0);
        else if (actor.input.stickL.Length() > .05)
        {
            float rot = Basis.LookingAt(moveVector).GetEuler().Y;
            actor.Rotation = new(actor.Rotation.X, Mathf.LerpAngle(actor.Rotation.Y, rot, Mathf.Min(12.5f * delta, 1)), 0);
        }

        Vector3 velocity = actor.Velocity;
        float storeY = velocity.Y;
        float forwardSpeed = actor.Velocity.Dot(moveVector);
        float accelForce = actor.speed * (1 - Mathf.Clamp(forwardSpeed / Actor3D.MaxSpeed, 0, 1));
        Vector3 forwardVelocity = moveVector * forwardSpeed;
        velocity -= (velocity - forwardVelocity) * GroundDrag * delta;

        if (forwardSpeed < 0)
            velocity -= forwardVelocity * GroundDrag * accelForce * delta;

        velocity += moveVector * accelForce * delta;

        // final component editing
        var (x, y, z) = (velocity.X, storeY, velocity.Z);

        y -= (float)(Gravity * delta);

        x = Math.Clamp(x, -1800, 1800);
        y = Math.Clamp(y, -75.6f, 180);
        z = Math.Clamp(z, -1800, 1800);

        actor.Velocity = new Vector3(x, y, z);
    }
}