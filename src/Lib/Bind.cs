using Godot;
using Parkour.Actor;

namespace Parkour.Lib;

public class Bind(string actionName)
{
    public string actionName = actionName;
    public bool pressed = false;
    public bool isDown = false;

    public void Update()
    {
        pressed = Input.IsActionJustPressed(actionName);
        isDown = Input.IsActionPressed(actionName);
    }

    public bool CheckEvent(Actor3D actor, InputEvent @event)
    {
        bool consumed = false;
        if (@event.IsActionPressed(actionName))
        {
            consumed = true;
            pressed = true;
            isDown = true;
        }
        else if (@event.IsActionReleased(actionName))
        {
            consumed = true;
            isDown = false;
        }

        if (consumed)
            actor.GetViewport().SetInputAsHandled();
        
        return consumed;
    }

    public override string ToString()
    {
        return $"{actionName}: {pressed} & {isDown}";
    }

    public bool Consume()
    {
        bool consumed = pressed;
        pressed = false;

        return consumed;
    }
}