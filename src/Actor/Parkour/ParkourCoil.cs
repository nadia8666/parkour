using Godot;

namespace Parkour.Actor.Parkour;

public partial class ActorParkour
{
    public const float CoilTweenHeight = 1.5F * Actor3D.Unit;
    public const float CoilMinSpeed = -15 * Actor3D.Unit;
    public const double CoilDuration = 1;
    public double lastCoilStart = 0;
    public bool coiling = false;

    public void Coil()
    {
        lastCoilStart = Actor3D.Clock();
        coiling = true;
        actor.TweenRoot(CoilTweenHeight, 0.1f);
        actor.animation.Play("coil");
    }

    public void CoilStep()
    {
        if (Actor3D.Clock() - lastCoilStart >= CoilDuration || actor.InCoyote)
        {
            coiling = false;

            if (actor.Airborne)
                actor.TweenRoot(-CoilTweenHeight, 0.1f);
        }
    }
}