using System;
using System.Collections.Generic;
using Godot;
using Parkour.Core;
using Parkour.Lib;

namespace Parkour.Actor;

public class ActorInput(Actor3D actor)
{
    // constants
    public const double InputDeadzone = 0.05;

    // where do i put this lol
    public readonly struct Binds
    {
        public readonly Bind upmove = new("upmove");
        public readonly Bind downmove = new("downmove");

        public Binds() { }
        public readonly IEnumerable<Bind> Iterator => [upmove, downmove];
    }

    // constructor
    private readonly Actor3D actor = actor;
    public readonly Binds binds = new();

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

        // binds
        foreach (Bind bind in binds.Iterator)
        {
            bind.Update();
        }
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
        actor.camera.SetZoom(actor.camera.Zoom + force);
    }

    // dont spam this too much :) its live calculated a bunch
    public Vector3 globalMoveVector => actor.camera.VectorToGlobalFlat(new Vector3(stickL.X, 0, stickL.Y));
}