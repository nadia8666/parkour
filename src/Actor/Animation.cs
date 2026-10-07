using System;
using Godot;
using Parkour.Lib;

namespace Parkour.Actor;

public class ActorAnimation
{
    private Actor3D actor;
    private AnimationTree tree;
    public ActorAnimation(Actor3D actor)
    {
        this.actor = actor;
        tree = actor.blendTree;
        tree.Active = true;
    }

    public void UpdateAnimations(float delta)
    {
        float movementForce = VUtil.WithY(actor.Velocity, 0).Length() / 2;
        tree.Set("parameters/IdleRunBlend/blend_position", movementForce);
        tree.Set("parameters/RunSpeed/scale", Mathf.Lerp(1, actor.speed / 10, Mathf.Min(movementForce, 1)));
    }
}