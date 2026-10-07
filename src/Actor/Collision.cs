using Godot;

namespace Parkour.Actor;

public class ActorCollision
{
    private Actor3D actor;
    public ActorCollision(Actor3D actor)
    {
        this.actor = actor;
    }

    public void CollideAndSlide()
    {
        Vector3 cacheVel = actor.Velocity;
        actor.MoveAndSlide();
        Vector3 reponseVel = actor.Velocity;

        // read new vel changes base on reponse vel :)
        //actor.Velocity = cacheVel;
    }
}