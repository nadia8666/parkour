using UnityEngine;
using UnityEditor;

#if UNITY_EDITOR
public class ZiplinePreviewComponent : MonoBehaviour
{
    public Transform Point1;
    public Transform Point2;

    public bool DrawInvalid()
    {
        if (!Point1 || !Point2)
        {
            Gizmos.color = Color.red;

            if (Point1) Gizmos.DrawSphere(Point1.position, 2);
            if (Point2) Gizmos.DrawSphere(Point2.position, 2);

            return true;
        }

        return false;
    }

    void OnDrawGizmos()
    {
        if (Application.isPlaying || DrawInvalid()) return;

        GameObject Selected = Selection.activeGameObject;

        // my guess: this is Not good for performance
        Gizmos.color = Selected && Selected.transform.GetComponentInChildren<ZiplinePreviewComponent>() == this ? Color.blue : Color.red;
        Gizmos.DrawLine(Point1.position, Point2.position);
    }
}
#endif