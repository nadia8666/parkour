using Godot;

namespace Parkour.Lib;

public static class Vector3Extensions
{
    extension(Vector3 vec)
    {
        /// <summary>
        /// return a copy of this vector with a new y value
        /// </summary>
        /// <param name="y"></param>
        /// <returns></returns>
        public Vector3 WithY(float y)
        {
            return new Vector3(vec.X, y, vec.Z);
        }
    }

    extension(Vector2 vec)
    {
        /// <summary>
        /// return a copy of this vector with a new y value
        /// </summary>
        /// <param name="y"></param>
        /// <returns></returns>
        public Vector2 WithY(float y)
        {
            return new Vector2(vec.X, y);
        }
    }
}