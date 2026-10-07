using Godot;
using Parkour.Lib;

namespace Parkour.Actor;

public partial class ActorAnimation : AnimationTree
{
    // state flags (do these need to be exported?)
    [Export] public bool grounded = true;
    [Export] public bool jumping = false;
    [Export] public bool coiling = false;
    [Export] public bool powersliding = false;
    
    // jump anim
    public bool jumpReset = false;
    private float jumpState = -1;
    private float lerpedJumpState = 0;

    // exports
    [Export] private Actor3D actor;

    public void UpdateAnimations(float delta)
    {
        // update state flags
        grounded = actor.Grounded;
        jumping = actor.parkour.jumpDecayActive;
        lerpedJumpState = Mathf.Lerp(lerpedJumpState, jumpState, Mathf.Min(10 * delta, 1));

        // jumping
        if (jumping && jumpReset)
        {
            ((AnimationNodeStateMachinePlayback)(GodotObject)Get("parameters/StateMachine/playback")).Travel("JumpBlend");
            jumpReset = false;
            jumpState = jumpState == -1 ? 1 : -1;
        }
        if (jumping)
            Set("parameters/StateMachine/JumpBlend/blend_position", lerpedJumpState);

        // idle/walk/run animations
        float movementForce = VUtil.WithY(actor.Velocity, 0).Length() / 2;
        Set("parameters/StateMachine/IdleRunBlend/blend_position", movementForce);

        float runSpeed = Mathf.Lerp(1, actor.momentum / 6, Mathf.Min(movementForce, 1));
        float animationSpeed = grounded ? runSpeed : 1;
        Set("parameters/TimeScale/scale", animationSpeed);
    }
}
