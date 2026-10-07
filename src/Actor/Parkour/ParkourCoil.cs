using Godot;

namespace Parkour.Actor.Parkour;

public partial class ActorParkour
{
    public const double CoilDuration = 1;
    public double lastCoilStart = 0;
    public bool coiling = false;

    public void Coil()
    {
        lastCoilStart = actor.Clock();
        coiling = true;
        // tween root up -1.5/unit over .1s
    }

    public void CoilStep()
    {
        if (actor.Clock() - lastCoilStart >= CoilDuration || actor.InCoyote)
        {
            GD.Print("coil OVER");
            coiling = false;

            if (actor.Airborne)
            {
                // tween root down -1.5/unit over .1s
            }
        }
    }
}