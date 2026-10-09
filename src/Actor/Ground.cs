using Godot;
using Godot.Collections;
using Parkour.Lib;

namespace Parkour.Actor;

public class ActorGround(Actor3D actor)
{
    // hover
    public const float HipHeight = 2f * Actor3D.Unit;
    public const float StairHeight = 0.5f * Actor3D.Unit; // step up grounded
    public const float AirborneStairHeight = 1.5f * Actor3D.Unit; // step up airborne
    public const float GroundedMargin = 1f * Actor3D.Unit;
    public const float MaxSnapSpeed = 1f * Actor3D.Unit; // do not snap to ground above this y speed
    public const float StairInfluence = 50f;
    public const float MaxSlope = 60f; // degrees

    // search
    private const float SearchRadius = 0.25f;
    private const float SearchHeight = 0.02f;
    private const float SearchStart = HipHeight + Actor3D.Unit; // collider origin

    // search results
    public bool Found { get; private set; }
    public bool IsGrounded { get; private set; }
    public float Height { get; private set; } // ground height above the feet
    public float Angle { get; private set; } // degrees
    public Vector3 Normal { get; private set; } = Vector3.Up;
    public float StickMargin { get; private set; } = GroundedMargin;

    private readonly Actor3D actor = actor;
    private PhysicsShapeQueryParameters3D queryParams;
    private Array<Rid> excludeList;

    private void SetupParams()
    {
        excludeList = new() { actor.GetRid() };
        queryParams = new()
        {
            Shape = new CylinderShape3D { Radius = SearchRadius, Height = SearchHeight },
            CollisionMask = actor.CollisionMask,
            Exclude = excludeList,
        };
    }

    public void SearchGround()
    {
        if (queryParams == null)
            SetupParams();

        Found = false;
        IsGrounded = false;
        Height = 0;
        Angle = 0;
        Normal = Vector3.Up;

        // scale cast distance by speed
        float travel = new Vector2(actor.Velocity.X, actor.Velocity.Z).Length() / Engine.PhysicsTicksPerSecond;
        StickMargin = GroundedMargin + travel;
        float reach = Mathf.Max(actor.Grounded ? StairHeight : AirborneStairHeight, StickMargin);

        float length = SearchStart + reach;
        Vector3 origin = actor.GlobalPosition + Vector3.Up * SearchStart;
        PhysicsDirectSpaceState3D space = actor.GetWorld3D().DirectSpaceState;

        queryParams.Transform = new Transform3D(Basis.Identity, origin);
        queryParams.Motion = Vector3.Down * length;
        float[] cast = Raycast.Space.CastMotion(queryParams);
        if (cast.Length < 2 || cast[1] >= 1f || cast[0] <= 0f)
            return;

        float contactY = origin.Y - cast[0] * length - SearchHeight / 2f;
        Found = true;
        Height = contactY - actor.GlobalPosition.Y;

        // surface normal
        if (Raycast.Cast(origin, origin + Vector3.Down * length, actor.CollisionMask, excludeList) is RaycastResults floorHit)
            Normal = floorHit.normal.Normalized();

        Angle = Mathf.RadToDeg(Mathf.Acos(Mathf.Clamp(Normal.Dot(Vector3.Up), -1f, 1f)));
        IsGrounded = actor.Velocity.Y <= MaxSnapSpeed
            && Angle <= MaxSlope
            && (Mathf.Abs(Height) < StickMargin || Height > 0);
    }

    public void StickToSlopes(float delta, bool sliding)
    {
        if (!Found || Angle > MaxSlope)
            return;

        float vy = actor.Velocity.Y;
        if (!sliding && vy > MaxSnapSpeed)
            return;

        float flatSpeed = new Vector2(actor.Velocity.X, actor.Velocity.Z).Length();
        float move = 0;
        if (sliding && Height > -StickMargin)
            move = Height;
        else if (flatSpeed > actor.momentum * 2f && Height > 0)
            move = Height;
        else if ((vy <= 0 && Mathf.Abs(Height) < StickMargin) || Height > 0)
            move = Height * (1f - Mathf.Exp(-StairInfluence * delta));

        actor.GlobalPosition += Vector3.Up * move;
    }
}