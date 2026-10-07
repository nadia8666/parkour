using Godot;
using Parkour.Lib;

namespace Parkour.Actor;

// TODO: compartmentalize parkour? split into sub sub modules like parkour.actor.parkour & parkour.actor.parkour.jump etc.
public class ActorParkour(Actor3D actor)
{
    private readonly Actor3D actor = actor;

    public bool Parkouring { get; private set; } = false;
    public void CheckMovement()
    {
        if (actor.input.binds.upmove.justPressed)
            Jump();
    }

    public void UpdateMovement(float delta)
    {
        CheckMovement();

        if (jumpDecayActive)
            JumpDecayStep(delta);
    }


    #region jump
    public bool jumpDecayActive = false;
    private double jumpDecayStart = 0;
    private float jumpPower = 0;
    public const float JumpFloatDecay = 64 * Actor3D.Unit;
    public float jumpFloatPower = 3;
    private float activeFloatPower = 0;
    public ulong jumpLastQuery = 0;
    public const float JumpSpeedInfluence = 0.4f;
    public const float JumpPowerBase = 6;

    public void Jump()
    {
        jumpLastQuery = actor.Clock();
        if (!actor.InCoyote || actor.ammo.jump <= 0) return;
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
    }

    public void JumpDecayStep(float delta)
    {
        if (actor.Clock() - jumpDecayStart > 0.05 && !actor.input.binds.upmove.isDown || activeFloatPower <= 0)
        {
            jumpDecayActive = false;
            actor.physics.gravity = ActorPhysics.DefaultGravity;

            return;
        }

        actor.physics.gravity = ActorPhysics.DefaultGravity - activeFloatPower;
        activeFloatPower = Mathf.Max(0, activeFloatPower - delta * JumpFloatDecay);
    }

    public void CheckJumpBuffer()
    {
        if (actor.Clock() - jumpLastQuery <= 0.075)
            Jump();
    }

    #endregion

    #region coil

    #endregion

    #region powerslide

    #endregion
}