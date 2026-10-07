using Godot;

namespace Parkour.Lib;

public static class Easing
{
    public static float EaseOutCirc(float alpha)
    {
        alpha = Mathf.Clamp(alpha, 0, 1);
        alpha -= 1f;
        return Mathf.Sqrt(1f - (alpha * alpha));
    }
}