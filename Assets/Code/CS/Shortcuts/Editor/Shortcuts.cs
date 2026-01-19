using System.Linq;
using UnityEditor;
using UnityEngine;

public static class Shortcuts
{
    #region Group Objects
    //https://discussions.unity.com/t/shortcut-to-create-empty-parent-with-transform-of-original-object/210482/5
    // %g  → Ctrl/Cmd + G
    [MenuItem("GameObject/Group Selected %g", false, 0)]
    private static void Group()
    {
        var selection = Selection.transforms;
        if (selection.Length == 0) return;

        // 1. Find the common parent (for cleaner hierarchy placement)
        Transform parent = selection[0].parent;

        // 2. Calculate the geometric centre of all selected objects
        Vector3 center = selection.Aggregate(Vector3.zero, (current, t) => current + t.position) / selection.Length;

        // 3. Create a new empty GameObject at that center
        GameObject group = new("Group");
        Undo.RegisterCreatedObjectUndo(group, "Create Group");
        group.transform.position = center;
        group.transform.SetParent(parent, true); // keep world pos

        // 4. Re-parent each selected object under the new group
        foreach (var t in selection)
            Undo.SetTransformParent(t, group.transform, "Group Selected");

        // 5. Make the new group the active selection
        Selection.activeTransform = group.transform;
    }

    // Validation method keeps the menu item enabled only when there’s a selection
    [MenuItem("GameObject/Group Selected %g", true)]
    private static bool ValidateGroup() => Selection.transforms.Length > 0;
    #endregion

    #region Rotate Object

    [MenuItem("GameObject/Rotate Selected 90 %r", false, 0)]
    private static void Rotate90()
    {
        var selection = Selection.transforms;
        if (selection.Length == 0) return;

        Undo.RecordObjects(selection, "Rotate Selected");
        foreach (var t in selection)
            t.rotation *= Quaternion.Euler(0, 90, 0);
    }
    [MenuItem("GameObject/Rotate Selected 90 %r", true)]
    private static bool ValidateRotate90() => Selection.transforms.Length > 0;

    #endregion
}