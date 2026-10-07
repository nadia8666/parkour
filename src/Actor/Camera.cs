using System;
using Godot;
using Parkour.Lib;

namespace Parkour.Actor;

public class ActorCamera
{
    // constants
    public static float CamMaxPitch = Mathf.DegToRad(89f);
    public const float MaxZoom = 8.96f;
    public const float MinZoom = 0.14f;
    private Actor3D actor;
    public Camera3D camera;

    public Vector2 rotation = new();

    // access only
    public Vector3 rawRotation { get; private set; } = new();
    public Vector3 rawRotationFlat { get; private set; } = new();
    public Vector3 rawLook { get; private set; } = new();
    public Vector3 rawLookFlat { get; private set; } = new(); // flat on x and z axis

    public float zoom { get; set; } = Mathf.Lerp(MinZoom, MaxZoom, 0.5f);

    public ActorCamera(Actor3D actor)
    {
        this.actor = actor;
        camera = actor.cameraObj;
    }

    public void SetZoom(float newZoom)
    {
        zoom = Mathf.Clamp(newZoom, MinZoom, MaxZoom);
        // updaet Things :)
    }

    public void UpdateCamera(float delta)
    {
        Input.MouseMode = !locked && !Input.IsMouseButtonPressed(MouseButton.Right) ? Input.MouseModeEnum.Visible : Input.MouseModeEnum.Captured;

        rotation = new Vector2(
            Mathf.Clamp(rotation.X - actor.input.stickR.Y, -CamMaxPitch, CamMaxPitch),
            (rotation.Y - actor.input.stickR.X) % Mathf.Tau
        );

        rawRotation = new(rotation.X, rotation.Y, 0);
        rawRotationFlat = new(0, rotation.Y, 0);
        rawLook = Basis.FromEuler(rawRotation).GetRotationQuaternion().Normalized() * Vector3.Forward;
        rawLookFlat = VUtil.WithY(rawLook, 0).Normalized(); // shouldnt ever nan with 89 deg max pitch
    }

    public void RenderCamera()
    {
        camera.Rotation = new Vector3(rotation.X, rotation.Y, 0);
        camera.Position = actor.Position + actor.GlobalBasis.GetRotationQuaternion().Normalized() * new Vector3(0, 1.8f, 0);
        camera.Position += camera.GlobalBasis.GetRotationQuaternion().Normalized() * new Vector3(0, 0, zoom);
    }

    public Vector3 VectorToGlobal(Vector3 localVec)
    {
        return Basis.FromEuler(rawRotation).GetRotationQuaternion().Normalized() * localVec;
    }

    public Vector3 VectorToGlobalFlat(Vector3 localVec)
    {
        return Basis.FromEuler(rawRotationFlat).GetRotationQuaternion().Normalized() * localVec;
    }

    public bool locked => zoom <= MinZoom;
}
