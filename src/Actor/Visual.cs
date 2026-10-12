using Godot;

namespace Parkour.Actor;

public class ActorVisual
{
    public const float PositionFrequency = 22f;
    public const float RotationFrequency = 18f;
    public const float TiltRate = 14f;

    private readonly Actor3D actor;
    private readonly Transform3D rest;

    private Vector3 position = Vector3.Zero;
    private Vector3 positionVelocity = Vector3.Zero;
    private Quaternion rotation = Quaternion.Identity;
    private Vector3 rotationVelocity = Vector3.Zero;
    private Quaternion tilt = Quaternion.Identity;

    public Quaternion ModelRotation { get; private set; } = Quaternion.Identity;

    public ActorVisual(Actor3D actor)
    {
        this.actor = actor;
        rest = actor.playerModel.Transform;
    }

    public void Absorb(Transform3D before)
    {
        Transform3D after = actor.GlobalTransform;

        position += before.Origin - after.Origin;
        rotation = (after.Basis.GetRotationQuaternion().Inverse() * before.Basis.GetRotationQuaternion() * rotation).Normalized();
    }

    public void AbsorbShift(Vector3 shift)
    {
        position -= shift;
    }

    public void Reset()
    {
        position = Vector3.Zero;
        positionVelocity = Vector3.Zero;
        rotation = Quaternion.Identity;
        rotationVelocity = Vector3.Zero;
        tilt = Quaternion.Identity;
    }

    public void Step(float delta)
    {
        Spring(ref position, ref positionVelocity, PositionFrequency, delta);

        Vector3 rotationVector = ToVector(rotation);
        Spring(ref rotationVector, ref rotationVelocity, RotationFrequency, delta);
        rotation = FromVector(rotationVector);

        Quaternion targetTilt = Quaternion.Identity;
        if (actor.parkour.slideActive && actor.Grounded)
        {
            Quaternion facing = actor.GlobalBasis.GetRotationQuaternion().Normalized();
            targetTilt = facing.Inverse() * new Quaternion(facing * Vector3.Up, actor.ground.Normal) * facing;
        }

        tilt = tilt.Slerp(targetTilt, 1f - Mathf.Exp(-TiltRate * delta)).Normalized();
        ModelRotation = (rotation * tilt).Normalized();

        actor.playerModel.Transform = new Transform3D(
            new Basis(ModelRotation) * rest.Basis,
            actor.GlobalBasis.Inverse() * position + rest.Origin
        );
    }

    private static void Spring(ref Vector3 value, ref Vector3 velocity, float frequency, float delta)
    {
        float decay = Mathf.Exp(-frequency * delta);
        Vector3 impulse = (velocity + value * frequency) * delta;

        velocity = (velocity - impulse * frequency) * decay;
        value = (value + impulse) * decay;
    }

    private static Vector3 ToVector(Quaternion quat)
    {
        if (quat.W < 0)
            quat = new Quaternion(-quat.X, -quat.Y, -quat.Z, -quat.W);

        float sine = Mathf.Sqrt(Mathf.Max(1f - quat.W * quat.W, 0f));
        if (sine < 0.00001f)
            return Vector3.Zero;

        return new Vector3(quat.X, quat.Y, quat.Z) / sine * (2f * Mathf.Acos(Mathf.Clamp(quat.W, -1f, 1f)));
    }

    private static Quaternion FromVector(Vector3 vector)
    {
        float angle = vector.Length();
        return angle < 0.000001f ? Quaternion.Identity : new Quaternion(vector / angle, angle);
    }
}
