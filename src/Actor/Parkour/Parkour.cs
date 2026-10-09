using Godot;

namespace Parkour.Actor.Parkour;

public partial class ActorParkour(Actor3D actor)
{
    private readonly Actor3D actor = actor;

    public string ParkourType { get; private set; } = "None";
    public bool Parkouring { get; private set; } = false;
    public void CheckMovement()
    {
        if (actor.Upmove.pressed)
        {
            actor.Upmove.Consume();
            bool jumped = Jump();
            if (!jumped) jumpLastQuery = Actor3D.Clock();
        }

        if (actor.Downmove.pressed)
        {
            if (!actor.InCoyote)
            {
                PrepareLanding();
                if (!coiling && actor.Velocity.Y >= CoilMinSpeed) Coil();
            }
            else
                TryPowerslide();

            actor.Downmove.Consume();
        }

        if (actor.Downmove.isDown && !actor.InCoyote)
            LastPrepareHeld = Actor3D.Clock();
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

        if (!actor.InCoyote && !actor.Downmove.isDown && LastPrepareLanding > 0 && Actor3D.Clock() - LastPrepareHeld >= .2)
            LastPrepareLanding = 0;
    }

    public void SetActive(string name)
    {
        Parkouring = true;
        ParkourType = name;
    }

    public void SetActive()
    {
        Parkouring = false;
        ParkourType = "None";
    }
}