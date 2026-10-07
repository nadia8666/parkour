using System;
using Godot;
using Parkour.Lib;

namespace Parkour.Actor;

public class ActorCamera
{
    // constants
    public const float CamMaxPitch = 1.55334f; // 89 degrees
    public const float MaxZoom = 8.96f;
    public const float MinZoom = 0.14f;
    private readonly Actor3D actor;
    public Camera3D camera;
    private readonly BaseMaterial3D bodyMat;

    public Vector2 rotation = new();

    // access only
    public Vector3 RawRotation { get; private set; } = new();
    public Vector3 RawRotationFlat { get; private set; } = new();
    public Vector3 RawLook { get; private set; } = new();
    public Vector3 RawLookFlat { get; private set; } = new(); // flat on x and z axis
    public float Zoom { get; set; } = Mathf.Lerp(MinZoom, MaxZoom, 0.5f);

    public ActorCamera(Actor3D actor)
    {
        this.actor = actor;
        camera = actor.cameraObj;

        bodyMat = (BaseMaterial3D)actor.playerMesh.Mesh.SurfaceGetMaterial(1).Duplicate();
        actor.playerMesh.SetSurfaceOverrideMaterial(1, bodyMat);
        bodyMat.Transparency = BaseMaterial3D.TransparencyEnum.Alpha;
        bodyMat.DepthDrawMode = BaseMaterial3D.DepthDrawModeEnum.Always;
    }

    public void SetZoom(float newZoom)
    {
        Zoom = Mathf.Clamp(newZoom, MinZoom, MaxZoom);
        // updaet Things :)
    }

    public void UpdateCamera(float delta)
    {
        Input.MouseMode = !Locked && !Input.IsMouseButtonPressed(MouseButton.Right) ? Input.MouseModeEnum.Visible : Input.MouseModeEnum.Captured;

        rotation = new Vector2(
            Mathf.Clamp(rotation.X - actor.input.stickR.Y, -CamMaxPitch, CamMaxPitch),
            (rotation.Y - actor.input.stickR.X) % Mathf.Tau
        );

        RawRotation = new(rotation.X, rotation.Y, 0);
        RawRotationFlat = new(0, rotation.Y, 0);
        RawLook = Basis.FromEuler(RawRotation).GetRotationQuaternion().Normalized() * Vector3.Forward;
        RawLookFlat = VUtil.WithY(RawLook, 0).Normalized(); // shouldnt ever nan with 89 deg max pitch
    }

    public void RenderCamera()
    {
        camera.GlobalTransform = actor.cameraAttach.GetGlobalTransformInterpolated();
        camera.Rotation = new Vector3(rotation.X, rotation.Y, 0);
        camera.Position += camera.GlobalBasis.GetRotationQuaternion().Normalized() * new Vector3(0, 0, Zoom);
        bodyMat.AlbedoColor = new(1, 1, 1, Locked ? 0 : 1);
    }

    public Vector3 VectorToGlobal(Vector3 localVec)
    {
        return Basis.FromEuler(RawRotation).GetRotationQuaternion().Normalized() * localVec;
    }

    public Vector3 VectorToGlobalFlat(Vector3 localVec)
    {
        return Basis.FromEuler(RawRotationFlat).GetRotationQuaternion().Normalized() * localVec;
    }

    public bool Locked => Zoom <= MinZoom;
}
