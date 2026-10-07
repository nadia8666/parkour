using Godot;

namespace Parkour.UI;

[GlobalClass]
public partial class UI2D : Control
{
    public static UI2D instance;

    public override void _EnterTree()
    {
        instance = this;
        base._EnterTree();
    }

    [Export] public Label velocityReadout;
}