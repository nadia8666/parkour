using Godot;
using Parkour.Lib;
using Parkour.UI;
using Parkour.Actor.Parkour;

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
    [Export] public Node3D playerModel;

    // submodules
    public ActorInput input;
    public ActorCamera camera;
    public ActorPhysics physics;
    public ActorParkour parkour;
    public ActorCollision collision;
    [Export] public ActorSound sound;
    [Export] public ActorAnimation animation;
    public ActorGround ground;

    // misc
    public bool RotationLocked => parkour.sliding;
    public bool MovementLocked => parkour.sliding;
    public Vector3 airVelocity = new();
    public static double Clock()
    {
        return (Time.GetTicksUsec() + 100) / 1_000_000F;
    }

    // input quick acess
    public Bind upmove => input.binds.upmove;
    public Bind downmove => input.binds.downmove;

    // constructor
    public override void _Ready()
    {
        base._Ready();

        input = new(this);
        camera = new(this);
        physics = new(this);
        parkour = new(this);
        collision = new(this);
        ground = new(this);

        // updated dynamically
        GetNode<CollisionShape3D>("CollisionShape3D").Position = new Vector3(0, ActorGround.HipHeight + Unit, 0);
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
        StepRootTween(fDelta);
        physics.StepPhysics(fDelta);
        collision.CollideAndSlide();

        // apparently animations always go in physics process instead of render. coming from roblox that sounds stupid but Sure
        animation.UpdateAnimations((float)delta);

        AlignToSlopes();

        if (Airborne)
            airVelocity = Velocity;

        HealStep(fDelta);
    }

    public void AlignToSlopes()
    {
        if (parkour.sliding && Grounded)
        {
            Quaternion quat = GlobalBasis.GetRotationQuaternion().Normalized();
            Quaternion diff = new(quat * Vector3.Up, ground.Normal);
            playerModel.GlobalBasis = new Basis(diff * quat).Scaled(playerModel.GlobalBasis.Scale);
        }
        else
            playerModel.Rotation = Vector3.Zero;
    }

    public override void _Process(double delta)
    {
        base._Process(delta);

        // TODO: visual debug ui, update values in the ui modules too
        UI2D.instance.velocityReadout.Text = $"{Velocity.X}\n{Velocity.Y}\n{Velocity.Z}";
        camera.RenderCamera();
        UI2D.instance.UpdateUI((float)delta, this);
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

    #region root movement
    private bool rootTweenActive = false;
    private float rootTweenTargetDuration = 0;
    private float rootTweenTargetHeight = 0;
    private float rootTweenProgress = 0;
    public void TweenRoot(float targetHeight, float length)
    {
        rootTweenActive = true;
        rootTweenTargetDuration = length;
        rootTweenTargetHeight = targetHeight;
        rootTweenProgress = 0;
    }

    public void StepRootTween(float delta)
    {
        if (rootTweenActive)
        {
            float newDelta = Mathf.Min(delta / rootTweenTargetDuration, rootTweenTargetDuration - rootTweenProgress);
            rootTweenProgress += newDelta;
            if (rootTweenProgress >= rootTweenTargetDuration)
                rootTweenActive = false;

            Position += new Vector3(0, rootTweenTargetHeight * newDelta, 0);
        }
    }

    #endregion

    #region ground/coyote
    public bool Airborne { get; private set; } = false;
    public bool Grounded { get; private set; } = false;
    public const double MinCoyoteTime = .2;
    public const double MaxCoyoteTime = 1;
    public double CoyoteDuration { get; private set; } = .1;
    public double lastGrounded = 0;

    public void UpdateGrounded()
    {
        // ground probe
        ground.SearchGround();
        bool isNowGrounded = ground.IsGrounded;

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
            {
                parkour.Land();
                parkour.CheckJumpBuffer();
            }

            CoyoteDuration = MinCoyoteTime;
        }
        else if (Grounded)
            CoyoteDuration = MinCoyoteTime + Mathf.Clamp(Mathf.Max(0, Velocity.Y) / 260, 0, 1) * (MaxCoyoteTime - MinCoyoteTime);

        SetGrounded(isNowGrounded);
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

    #region health
    public const float MaxHealth = 100;
    public const double RegenFactor = 8;
    public float Health { get; private set; } = MaxHealth;
    public double lastHurt = 0;

    public void SetHealth(float health)
    {
        Health = Mathf.Clamp(health, 0, MaxHealth);
    }

    public void ChangeHealth(float change)
    {
        Health = Mathf.Clamp(Health + change, 0, MaxHealth);

        if (change < 0)
            lastHurt = Clock();
    }

    public void HealStep(float delta)
    {
        if (Health >= MaxHealth) return;

        double diff = Clock() - lastHurt;
        if (diff >= 1.25)
            ChangeHealth((float)(diff * delta * RegenFactor * (Velocity.Length() > 2 ? .15 : 1)));
    }
    #endregion

    // misc
    public Vector3 LookFlat => camera.Locked ? camera.RawLookFlat : GlobalBasis.GetRotationQuaternion().Normalized() * Vector3.Forward;

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