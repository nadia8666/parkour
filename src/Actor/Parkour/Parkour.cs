using Godot;

namespace Parkour.Actor.Parkour;

public partial class ActorParkour(Actor3D actor)
{
    private readonly Actor3D actor = actor;

    public bool Parkouring { get; private set; } = false;
    public void CheckMovement()
    {
        if (actor.input.binds.upmove.justPressed)
        {
            bool jumped = Jump();
            if (!jumped)
                jumpLastQuery = actor.Clock();
        }

        if (actor.input.binds.downmove.justPressed)
        {
            if (!actor.InCoyote)
            {
                PrepareLanding();
                if (!coiling && actor.Velocity.Y >= CoilMinSpeed) Coil();
            }
            else
                TryPowerslide();
        }

        if (actor.input.binds.downmove.isDown && !actor.InCoyote)
            LastPrepareHeld = actor.Clock();
    }

    public void UpdateMovement(float delta)
    {
        CheckMovement();

        if (jumpDecayActive)
            JumpDecayStep(delta);

        if (coiling)
            CoilStep();

        if (sliding)
            SlideStep(delta);

        if (!actor.InCoyote && !actor.input.binds.downmove.isDown && LastPrepareLanding > 0 && actor.Clock() - LastPrepareHeld >= .2)
            LastPrepareLanding = 0;
    }
}