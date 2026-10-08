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

        //float longJumpMultiplier = 0.6f; // TODO: implement for horizontal stuff longjumping etc
        jumpPower = JumpPowerBase * Actor3D.Unit + actor.momentum * JumpSpeedInfluence;
        activeFloatPower = jumpPower * jumpFloatPower;

        float yVel = Mathf.Max(0, actor.Velocity.Y) + jumpPower;
        actor.Velocity = VUtil.WithY(actor.Velocity, yVel);

        jumpDecayActive = true;
        jumpDecayStart = actor.Clock();

        actor.SetGrounded(false);
        actor.lastGrounded = 0;
        actor.animation.jumpReset = true;
        coiling = false;
        sliding = false;

        return true;
    }

    public void JumpDecayStep(float delta)
    {
        if ((actor.Clock() - jumpDecayStart > 0.05 && !actor.input.binds.upmove.isDown) || activeFloatPower <= 0)
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
        if (actor.Clock() - jumpLastQuery <= 0.075)
            return Jump();

        return false;
    }
}