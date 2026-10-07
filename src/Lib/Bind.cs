using Godot;

namespace Parkour.Lib;

public class Bind(string actionName)
{
    public string actionName = actionName;
    public bool justPressed = false;
    public bool isDown = false;
    public bool justReleased = false;

    public void Update()
    {
        justPressed = Input.IsActionJustPressed(actionName);
        isDown = Input.IsActionPressed(actionName);
        justReleased = Input.IsActionJustReleased(actionName);
    }

    public override string ToString()
    {
        return $"{actionName}: {justPressed} & {isDown} & {justReleased}";
    }
}