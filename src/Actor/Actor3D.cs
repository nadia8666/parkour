using System;
using Godot;
using Parkour.Lib;
using Parkour.UI;

namespace Parkour.Actor;

[GlobalClass]
public partial class Actor3D : CharacterBody3D
{
    // exposed props
    [Export] public Camera3D cameraObj;
    [Export] public AnimationTree blendTree;

    // submodules
    public ActorInput input;
    public ActorCamera camera;
    public ActorPhysics physics;
    public ActorMovement movement;
    public ActorAnimation animation;
    public ActorCollision collision;

    // constructor
    public override void _Ready()
    {
        base._Ready();

        input = new(this);
        camera = new(this);
        physics = new(this);
        movement = new(this);
        animation = new(this);
        collision = new(this);
    }

    public override void _PhysicsProcess(double delta)
    {
        base._PhysicsProcess(delta);
        float fDelta = (float)delta;

        // input
        input.UpdateInput(fDelta);
        camera.UpdateCamera(fDelta);

        // misc
        UpdateSpeed(fDelta);

        // physics
        physics.StepPhysics(fDelta);
        collision.CollideAndSlide();
    }

    public override void _Process(double delta)
    {
        base._Process(delta);

        // rotation updates with physics, only draw new rotation in post-phys step for actor changes
        camera.RenderCamera();
        animation.UpdateAnimations((float)delta);

        // TODO: make real
        UI2D.instance.velocityReadout.Text = $"{Velocity.X}\n{Velocity.Y}\n{Velocity.Z}";
    }

    // speed
    public const float BaseSpeed = 3.36f * 4f;
    public const float MaxSpeed = 8.96f * 4f;
    public const float SpeedAccelFloor = 0.07f * 4f;
    public const float SpeedAccelCoeff = 11.76f * 4f;
    public float speed = 3.36f;

    public void UpdateSpeed(float delta)
    {
        if (VUtil.WithY(Velocity, 0).Length() > 1)
        {
            float speedAlpha = speed / MaxSpeed;
            float accel = Mathf.Max(SpeedAccelFloor, (1 - Easing.EaseOutCirc(speedAlpha)) * SpeedAccelCoeff);
            speed = Mathf.Clamp(speed + accel * delta, BaseSpeed, MaxSpeed);
        }
        else
        {
            // inaccurate, is just set to 0 iirc
            speed = Mathf.Lerp(speed, BaseSpeed, Mathf.Min(5 * delta, 1));
        }
    }

    public override void _Input(InputEvent @event)
    {
        base._Input(@event);
        input.ProcessInput(@event);
    }

    public override void _UnhandledInput(InputEvent @event)
    {
        base._UnhandledInput(@event);

        if (@event.IsActionPressed("cam_zoom_in") || @event.IsActionPressed("cam_zoom_out"))
        {
            input.UpdateZoom(@event.IsActionPressed("cam_zoom_in"));
            GetViewport().SetInputAsHandled();
        }
    }
}