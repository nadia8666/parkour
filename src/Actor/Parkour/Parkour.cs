namespace Parkour.Actor.Parkour;

public partial class ActorParkour(Actor3D actor)
{
    private readonly Actor3D actor = actor;

    public string ParkourType { get; private set; } = "None";
    public bool Parkouring { get; private set; } = false;
    public void CheckMovement()
    {
        if (actor.Frozen || Parkouring) return;

        if (actor.Upmove.pressed)
        {
            actor.Upmove.Consume();

            if (actor.InCoyote)
            {
                if (GetLedgeGrabData(actor.Position) is LedgeGrabData vaultData) // TODO: eventually replace with a separate vault move isntead of ledgegrab
                {
                    actor.input.ConsumeAll();
                    StartLedgeGrab(vaultData);
                }
                else
                {
                    bool jumped = Jump();
                    if (!jumped) jumpLastQuery = Actor3D.Clock();
                }
            }
            else
            {
                if (GetLedgeGrabData(actor.Center) is LedgeGrabData data)
                {
                    actor.input.ConsumeAll();
                    StartLedgeGrab(data);
                }
                else if (GetLedgeGrabData(actor.Position) is LedgeGrabData vaultData) // TODO: eventually replace with a separate vault move isntead of ledgegrab
                {
                    actor.input.ConsumeAll();
                    StartLedgeGrab(vaultData);
                }
                else if (GetWallrunData() is WallrunData wallrunData)
                    StartWallrun(wallrunData);
            }
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

        // may very well be a good idea to do this dynamically. lol. possible even in SetActive() ?
        if (jumpDecayActive)
            JumpDecayStep(delta);

        if (coiling)
            CoilStep();

        if (slideActive)
            SlideStep(delta);

        if (ledgeGrabbing)
            StepLedgeGrab(delta);

        if (ledgeVaulting)
            StepLedgeVault(delta);

        if (wallrunActive)
            StepWallrun(delta);

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