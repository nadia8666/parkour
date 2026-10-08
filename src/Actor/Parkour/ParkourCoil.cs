using Godot;

namespace Parkour.Actor.Parkour;

public partial class ActorParkour
{
    public const float CoilTweenHeight = 1.5F * Actor3D.Unit;
    public const double CoilDuration = 1;
    public double lastCoilStart = 0;
    public bool coiling = false;

    public void Coil()
    {
        lastCoilStart = actor.Clock();
        coiling = true;
        actor.TweenRoot(CoilTweenHeight, 0.1f);
        // tween root up -1.5/unit over .1s
    }

    public void CoilStep()
    {
        if (actor.Clock() - lastCoilStart >= CoilDuration || actor.InCoyote)
        {
            coiling = false;

            if (actor.Airborne)
            {
                // tween root down -1.5/unit over .1s
                actor.TweenRoot(-CoilTweenHeight, 0.1f);
            }
            else if (actor.input.binds.downmove.isDown)
                TryPowerslide();
        }
    }
}