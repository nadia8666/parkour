using System;
using Godot;
using Parkour.Core;

namespace Parkour.Actor;

public class ActorInput
{
    // constants
    public const double InputDeadzone = 0.05;

    // constructor
    private Actor3D actor;
    public ActorInput(Actor3D actor)
    {
        this.actor = actor;
    }

    // input
    public float cameraSensGamepad = 20f;
    public float cameraSensMouse = 1.1f;
    public Vector2 stickL = new();
    public Vector2 stickR = new();
    public Vector2 mouseDelta = new();
    public void UpdateInput(float delta)
    {
        // sticks
        stickL = new Vector2(
            (Input.IsActionPressed("move_left") ? -1 : 0) + (Input.IsActionPressed("move_right") ? 1 : 0),
            (Input.IsActionPressed("move_up") ? -1 : 0) + (Input.IsActionPressed("move_down") ? 1 : 0)
        ).Normalized();

        stickR = new Vector2(
            (Input.IsActionPressed("cam_left") ? -1 : 0) + (Input.IsActionPressed("cam_right") ? 1 : 0),
            (Input.IsActionPressed("cam_up") ? -1 : 0) + (Input.IsActionPressed("cam_down") ? 1 : 0)
        ) * delta * cameraSensGamepad + mouseDelta; // dont normalize

        // consume delta
        mouseDelta = new();
    }

    public void ProcessInput(InputEvent @event)
    {
        if (@event is InputEventMouseMotion mouseMotion && Input.MouseMode == Input.MouseModeEnum.Captured)
        {
            // update as many times as needed to be consumed next step
            var size = actor.GetViewport().GetVisibleRect().Size;
            mouseDelta += mouseMotion.Relative / size * cameraSensMouse;
        }
    }

    public void UpdateZoom(bool zoomIn)
    {
        float force = zoomIn ? -.5f : .5f;
        actor.camera.SetZoom(actor.camera.zoom + force);
    }

    // dont spam this too much :) its live calculated a bunch
    public Vector3 globalMoveVector => actor.camera.VectorToGlobalFlat(new Vector3(stickL.X, 0, stickL.Y));
}