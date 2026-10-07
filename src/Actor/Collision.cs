using Godot;

namespace Parkour.Actor;

public class ActorCollision(Actor3D actor)
{
    private readonly Actor3D actor = actor;

    public void CollideAndSlide()
    {
        Vector3 cacheVel = actor.Velocity;
        actor.MoveAndSlide();
        Vector3 reponseVel = actor.Velocity;

        // read new vel changes base on reponse vel :)
        //actor.Velocity = cacheVel;
    }
}