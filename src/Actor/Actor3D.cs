using Godot;
using Parkour.Lib;
using Parkour.UI;

namespace Parkour.Actor;

[GlobalClass]
public partial class Actor3D : CharacterBody3D
{
    // hello im global
    public const float Unit = 0.28f; // i would have called this scale like every other framework i have made but scale is Real here.

    // exposed props
    [Export] public Camera3D cameraObj;
    [Export] public AnimationTree blendTree;
    [Export] public Node3D cameraAttach;
    [Export] public MeshInstance3D playerMesh;
    [Export] public Area3D groundSensor;

    // submodules
    public ActorInput input;
    public ActorCamera camera;
    public ActorPhysics physics;
    public ActorParkour parkour;
    [Export] public ActorAnimation animation;
    public ActorCollision collision;

    // timekeeping
    public ulong Clock()
    {
        return Time.GetTicksUsec() + 100;
    }

    // constructor
    public override void _Ready()
    {
        base._Ready();

        input = new(this);
        camera = new(this);
        physics = new(this);
        parkour = new(this);
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

        // movement queries
        UpdateGrounded();
        parkour.UpdateMovement(fDelta);

        // physics
        physics.StepPhysics(fDelta);
        collision.CollideAndSlide();

        // apparently camera and animations always go in physics process instead of render. coming from roblox that sounds stupid but Sure
        animation.UpdateAnimations((float)delta);
        camera.RenderCamera();
    }

    public override void _Process(double delta)
    {
        base._Process(delta);

        // TODO: visual debug ui, update values in the ui modules too
        UI2D.instance.velocityReadout.Text = $"{Velocity.X}\n{Velocity.Y}\n{Velocity.Z}";
    }

    #region speed
    public const float BaseMomentum = 12f * Unit;
    public const float MomentumCap = 26f * Unit;
    public const float MaxMomentum = 32f * Unit;
    public const float SlowMomentumFloor = 8f * Unit;
    public const float MomentumAccelFloor = 0.25f * Unit;
    public const float MomentumAccelCoeff = 42f * Unit;
    public float momentum = BaseMomentum;
    private float timeUnderSlowFloor;

    public void UpdateSpeed(float delta)
    {
        float flatSpeed = VUtil.WithY(Velocity, 0).Length();
        float alpha = Mathf.Clamp(Mathf.InverseLerp(BaseMomentum, MaxMomentum, momentum), 0, 1);
        timeUnderSlowFloor = flatSpeed <= SlowMomentumFloor ? timeUnderSlowFloor + delta : 0;

        if (Grounded) // should it factor in coyote? i dont think so... but maybe
        {
            float keepUp = momentum - 2 * Unit;
            if (flatSpeed > SlowMomentumFloor && flatSpeed > keepUp)
                momentum += Mathf.Max(MomentumAccelFloor, (1 - Easing.EaseOutCirc(alpha)) * MomentumAccelCoeff) * delta;
            else if (flatSpeed < keepUp)
                momentum -= (0.25f + alpha * 0.75f) * Unit * delta;

            if (timeUnderSlowFloor > 0.2f)
                momentum = Mathf.Lerp(momentum, BaseMomentum, 1 - Mathf.Exp(-8 * delta));
        }

        momentum = Mathf.Clamp(momentum, BaseMomentum, MomentumCap);
    }
    #endregion

    #region ground/coyote
    public bool Airborne { get; private set; } = false;
    public bool Grounded { get; private set; } = false;
    public double CoyoteDuration { get; private set; } = .1;
    public ulong lastGrounded = 0;

    public void UpdateGrounded()
    {
        // ground collider sweep
        bool isNowGrounded = groundSensor.HasOverlappingBodies();

        // forward facing ledge cast
        if (!isNowGrounded)
        {
            // TODO: litearlly all of this.... instead of forward use 12 rays for 360 detection :)
        }

        if (isNowGrounded)
        {
            RefillAmmo();
            lastGrounded = Clock();

            if (Airborne)
                parkour.CheckJumpBuffer(); // i would like thsit o be cleaner tbh
        }

        Grounded = isNowGrounded;
        Airborne = !isNowGrounded;
    }

    public void SetGrounded(bool grounded)
    {
        Grounded = grounded;
        Airborne = !grounded;
    }

    public bool InCoyote => Grounded | (Clock() - lastGrounded <= CoyoteDuration);
    #endregion

    // maybe in its own section with gear?
    #region ammo
    public struct Ammo
    {
        public int maxJump = 1;
        public int jump = 1;

        public Ammo() { }
    }

    public Ammo ammo = new();

    public void RefillAmmo()
    {
        ammo.jump = ammo.maxJump;
    }
    #endregion

    // input events
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