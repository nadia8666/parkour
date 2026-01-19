using System.Linq;
using UnityEngine;

[CustomAirshipEditor("LadderComponent")]
public class LadderComponentEditor : AirshipEditor
{
    public override void OnInspectorGUI()
    {
        DrawDefaultInspector();
        AirshipEditorGUI.HorizontalLine();
        if (GUILayout.Button("Rebuild Meshes"))
        {
            var Reference = serializedObject.FindAirshipProperty("ReferenceModel").objectReferenceValue as GameObject;
            var Container = serializedObject.FindAirshipProperty("Container").objectReferenceValue as Transform;
            var RootTransform = target as AirshipComponent;

            if (!Reference || !Container || !RootTransform) return;

            Container.Cast<Transform>().ToList().ForEach(Child => DestroyImmediate(Child.gameObject));

            var TargetSize = Mathf.CeilToInt(RootTransform.transform.lossyScale.y);
            var Scale = 1.0f / TargetSize;
            for (int Index = 0; Index < TargetSize; Index++)
            {
                var Child = Instantiate(Reference);
                Child.transform.SetParent(Container);
                Child.transform.localPosition = new Vector3(0, Scale * Index + (0.5f * Scale), 0);
                Child.transform.localRotation = Quaternion.Euler(0, 90, 0);
                Child.transform.localScale = new Vector3(1, Scale, 1);
            }
        }
    }
}
