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
            GD.Print("just pressed down:)", " ", actor.InCoyote, coiling);
            if (!actor.InCoyote)
            {
                if (!coiling) Coil();
            }
            else
                TryPowerslide();
        }
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
    }
}