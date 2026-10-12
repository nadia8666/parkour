using System;
using Godot;
using Parkour.Lib;

namespace Parkour.Actor.Parkour;

public partial class ActorParkour
{
    public struct WallrunData(Vector3 wallDir, Vector3 normal, bool left)
    {
        public Vector3 wallDir = wallDir;
        public Vector3 normal = normal;
        public bool left = left;
    }

    public const float WallrunLength = 2; // seconds
    public const float WallrunJumpPower = 3;
    public const float WallrunCastDistance = 2.15f;
    public const float WallrunCoyoteTime = 0.2f;

    // so theres already a current parkour active system for like ledgegrab and such Might be a good idea to define an activetype enum isntead
    public bool wallrunActive = false;
    public WallrunData? currentWallrun;
    public float wallrunDuration = 0;
    public float wallrunCoyoteDuration = 0;

    public WallrunData WrapWallrunResults(RaycastResults cast, Vector3 dir, bool left)
    {
        Vector3 flatNormal = cast.normal.WithY(0).Normalized();
        actor.Center = cast.position + (flatNormal * 0.3f);
        return new WallrunData(dir, flatNormal, left);
    }

    public bool WallrunValidNormal(Vector3 normal)
    {
        if (Mathf.Abs(normal.Y) <= 0.35f)
            return Mathf.Abs(normal.WithY(0).Normalized().Dot(actor.camera.Locked ? actor.camera.RawLookFlat : actor.GenericTarget)) <= .7;

        return false;
    }

    public WallrunData? GetWallrunData()
    {
        if (actor.ammo.wallrun <= 0)
            return null;

        var (left, right) = (GetWallrunDir(true), GetWallrunDir(false));

        Vector3 targetDir = left.Dot(actor.input.globalMoveVector) > 0 ? left : right;
        Vector3 otherDir = targetDir == left ? right : left;

        if (WallrunCast(targetDir) is RaycastResults data && WallrunValidNormal(data.normal))
            return WrapWallrunResults(data, targetDir, targetDir == left);
        else if (WallrunCast(otherDir) is RaycastResults otherData && WallrunValidNormal(otherData.normal))
            return WrapWallrunResults(otherData, otherDir, otherDir == left);

        return null;
    }

    public Vector3 GetWallrunDir(bool left)
    {
        return actor.Quaternion * (left ? Vector3.Left : Vector3.Right);
    }

    public void AlignWallrun()
    {
        actor.GlobalBasis = new Basis(LedgeFacingOf(currentWallrun.Value.normal.WithY(0).Normalized()) * Quaternion.FromEuler(new Vector3(0, currentWallrun.Value.left ? -Mathf.Pi / 2 : Mathf.Pi / 2, 0)));
    }

    public void StartWallrun(WallrunData data)
    {
        actor.ammo.wallrun--;
        actor.physics.gravity = ActorPhysics.DefaultGravity / 4; // maybe only apply divided gravity when traveling Downwards.
        SetActive("Wallrun");
        wallrunActive = true;

        wallrunDuration = 0;
        wallrunCoyoteDuration = 0;

        currentWallrun = data;
        AlignWallrun();
        UpdateWallrunVelocity();
        actor.Velocity = actor.Velocity.WithY(actor.Velocity.Y < 0 ? actor.Velocity.Y / 4 : actor.Velocity.Y);

        actor.animation.StopType("airborne");
        actor.animation.Play($"wallrun_{(data.left ? 'l' : 'r')}");
    }

    public RaycastResults? WallrunCast(Vector3 dir)
    {
        return Raycast.Cast(actor.Center, actor.Center + dir * WallrunCastDistance, actor.CollisionMask, actor.ground.excludeList);
    }

    public void StopWallrun()
    {
        actor.physics.gravity = ActorPhysics.DefaultGravity;
        wallrunActive = false;

        actor.animation.Stop("wallrun_l");
        actor.animation.Stop("wallrun_r");
        SetActive();
    }

    public void WallrunJump()
    {
        StopWallrun();

        Vector3 target = actor.camera.Locked ? actor.camera.RawLookFlat : actor.GenericTarget;
        float force = actor.Velocity.WithY(0).Length();

        actor.Velocity = (target * (force + WallrunJumpPower)).WithY(Mathf.Max(actor.Velocity.Y / 2, 0) + WallrunJumpPower * 2);
        jumpDecayActive = true;
        jumpDecayStart = Actor3D.Clock();
        activeFloatPower = 12;

        actor.animation.PlayJump(true); // TEMPORARY
    }

    public Vector3 UpdateWallrunVelocity()
    {
        float force = Mathf.Max(actor.Velocity.WithY(0).Length(), 4);
        Vector3 localVel = actor.Quaternion.Inverse() * actor.Velocity;
        actor.Velocity = actor.Quaternion * new Vector3(0, actor.Velocity.Y, force * Mathf.Sign(localVel.Z));
        return localVel;
    }

    public void StepWallrun(float delta)
    {
        actor.animation.SetSpeed("wallrun_l", actor.Velocity.Length() / 5);
        actor.animation.SetSpeed("wallrun_r", actor.Velocity.Length() / 5);

        wallrunDuration += delta;
        AlignWallrun();

        bool noWall = false;
        Vector3 dir = GetWallrunDir(currentWallrun.Value.left);
        if (WallrunCast(dir) is RaycastResults cast)
        {
            bool diff = currentWallrun.Value.normal.WithY(0).Normalized() != cast.normal.WithY(0).Normalized();
            currentWallrun = WrapWallrunResults(cast, dir, currentWallrun.Value.left);
            wallrunCoyoteDuration = 0;
            if (diff)
                AlignWallrun();
        }
        else
        {
            wallrunCoyoteDuration += delta;
            noWall = wallrunCoyoteDuration >= WallrunCoyoteTime;
        }

        UpdateWallrunVelocity();

        if (wallrunDuration >= WallrunLength || actor.Grounded || noWall)
        {
            StopWallrun();
            return;
        }

        if (actor.Upmove.pressed)
        {
            actor.Upmove.Consume();
            WallrunJump();
            return;
        }
    }
}