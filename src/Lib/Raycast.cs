using Godot;
using Godot.Collections;
using Microsoft.Extensions.DependencyInjection;
using Parkour.Core;

namespace Parkour.Lib;

public struct RaycastResults(Vector3 position, Vector3 normal, Node3D collider, Rid rid)
{
    public Vector3 position = position;
    public Vector3 normal = normal;
    public Node3D collider = collider;
    public Rid rid = rid;
    public int shape;
}

public static class Raycast
{
    public static PhysicsDirectSpaceState3D Space { get; private set; }

    public static RaycastResults? Cast(Vector3 origin, Vector3 target, uint collisionMask, Array<Rid> excludeList)
    {
        PhysicsRayQueryParameters3D ray = PhysicsRayQueryParameters3D.Create(origin, target, collisionMask, excludeList);
        Dictionary results = Space.IntersectRay(ray);

        return results.Count > 0 ? new RaycastResults((Vector3)results["position"], (Vector3)results["normal"], (Node3D)(GodotObject)results["collider"], (Rid)results["rid"]) : null;
    }

    static Raycast()
    {
        Space = ServiceLoader.Services.GetService<SceneContainer>().Scene.GetWorld3D().DirectSpaceState;
    }
}