using Godot;
using System;

namespace Parkour.Lib;

public static class VUtil
{   
    public static Vector3 WithY(Vector3 vec, float y)
    {
        return new Vector3(vec.X, y, vec.Z);
    }

    public static Vector2 WithY(Vector2 vec, float y)
    {
        return new Vector2(vec.X, y);
    }
}