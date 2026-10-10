using Godot;
using Parkour.Lib;

namespace Parkour.Actor.Parkour;

public partial class ActorParkour
{
    public bool jumpDecayActive = false;
    private double jumpDecayStart = 0;
    private float jumpPower = 0;
    public const float JumpFloatDecay = 64 * Actor3D.Unit;
    public float jumpFloatPower = 3;
    private float activeFloatPower = 0;
    public double jumpLastQuery = 0;
    public const float JumpSpeedInfluence = 0.4f;
    public const float JumpPowerBase = 6;

    public bool Jump()
    {
        if (!actor.InCoyote || actor.ammo.jump <= 0) return false;
        actor.ammo.jump--;

        bool edgeJump = false;
        float horizPower = actor.Velocity.WithY(0).Length();
        Vector3 hDir = horizPower <= 0 ? Vector3.Zero : actor.Velocity.WithY(0).Normalized();

        jumpPower = JumpPowerBase * Actor3D.Unit + actor.momentum * JumpSpeedInfluence;
        activeFloatPower = jumpPower * jumpFloatPower;

        Vector3 _origin = actor.Position + hDir;
        if (actor.Dash.isDown && Raycast.Cast(_origin + Vector3.Up, _origin + Vector3.Down * 0.05f, actor.CollisionMask, actor.ground.excludeList) == null)
        {
            edgeJump = true;

            Vector3 moveVec = actor.input.globalMoveVector;
            hDir = moveVec.LengthSquared() > 0 ? hDir.Slerp(moveVec, Mathf.Clamp(hDir.Dot(moveVec), -0.3f, 1)) : hDir;
            horizPower += 3.25f;
            jumpPower += 2;
        }

        coiling = false;
        actor.animation.Stop("roll");

        if (sliding)
        {
            EndSlide();
            horizPower = edgeJump ? Mathf.Max(horizPower, slideEntrySpeed) : slideEntrySpeed;
        }

        float yVel = Mathf.Max(0, actor.Velocity.Y) + jumpPower;
        actor.Velocity = (hDir * horizPower).WithY(yVel);

        jumpDecayActive = true;
        jumpDecayStart = Actor3D.Clock();

        actor.SetGrounded(false);
        actor.lastGrounded = 0;
        actor.animation.PlayJump(edgeJump);

        return true;
    }

    public void JumpDecayStep(float delta)
    {
        if ((Actor3D.Clock() - jumpDecayStart > 0.05 && !actor.Upmove.isDown) || activeFloatPower <= 0)
        {
            jumpDecayActive = false;
            actor.physics.gravity = ActorPhysics.DefaultGravity;

            return;
        }

        actor.physics.gravity = ActorPhysics.DefaultGravity - activeFloatPower;
        activeFloatPower = Mathf.Max(0, activeFloatPower - delta * JumpFloatDecay);
    }

    public bool CheckJumpBuffer()
    {
        if (Actor3D.Clock() - jumpLastQuery <= 0.075)
            return Jump();

        return false;
    }
}