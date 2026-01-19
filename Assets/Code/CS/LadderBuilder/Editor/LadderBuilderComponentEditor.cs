using System.Linq;
using UnityEditor;
using UnityEngine;

[CustomEditor(typeof(LadderBuilderComponent))]
public class LadderBuilderComponent_Inspector : UnityEditor.Editor
{
    public override void OnInspectorGUI()
    {
        DrawDefaultInspector();

        if (GUILayout.Button("Rebuild Meshes"))
        {
            LadderBuilderComponent Builder = (LadderBuilderComponent)target;
            var Reference = Builder.ReferenceModel;
            var Container = Builder.Container;
            var RootTransform = Builder.transform;

            Container.Cast<Transform>().ToList().ForEach(Child => DestroyImmediate(Child.gameObject));

            var TargetSize = Mathf.CeilToInt(RootTransform.lossyScale.y);
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
