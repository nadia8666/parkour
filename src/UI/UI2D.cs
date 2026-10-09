using Godot;
using Parkour.Actor;

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

    // health
    [Export] public Panel healthBar;
    [Export] public Panel healthBarInner;
    public float lerpedHealth = 100;
    public double lastDisplayed = 0;

    public void UpdateHealth(float delta, float health)
    {
        lerpedHealth = Mathf.Lerp(lerpedHealth, health, Mathf.Min(5 * delta, 1));
        if (health >= Actor3D.MaxHealth && lerpedHealth >= Actor3D.MaxHealth * .99)
            lerpedHealth = Actor3D.MaxHealth;


        healthBar.Visible = lerpedHealth < Actor3D.MaxHealth;
        healthBarInner.Scale = new(lerpedHealth / Actor3D.MaxHealth, 1);
    }

    public void UpdateUI(float delta, Actor3D actor)
    {
        UpdateHealth(delta, actor.Health);
    }
}