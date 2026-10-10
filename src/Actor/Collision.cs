using Godot;
using Parkour.Lib;

namespace Parkour.Actor;

public class ActorCollision(Actor3D actor)
{
    private readonly Actor3D actor = actor;

    public void CollideAndSlide()
    {
        if (actor.Frozen) return;
        
        Vector3 cacheVel = actor.Velocity;
        actor.MoveAndSlide();
        Vector3 reponseVel = actor.Velocity;

        if (actor.input.stickL.Length() >= .15)
        {
            // keep!
            actor.Velocity = cacheVel.WithY(reponseVel.Y);
        }
        else
        {
            // bounce :) idk how to do this yet because i need to get the wlal normal from move and slide which is.. ???
        }
    }
}