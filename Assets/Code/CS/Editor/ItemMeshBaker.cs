// ai generated
using UnityEngine;
using UnityEditor;
using System.Collections.Generic;

public class ItemMeshBaker : UnityEditor.Editor
{
    private const float PPU = 100f;

    [MenuItem("Parkour/Bake Generated Item Meshes")]
    public static void Bake()
    {
        string outDir = "Assets/Assets/Models/Item";
        if (!System.IO.Directory.Exists(outDir)) System.IO.Directory.CreateDirectory(outDir);

        string[] guids = AssetDatabase.FindAssets("t:ScriptableObject", new[] { "Assets/Resources/Items" });
        int count = guids.Length;

        for (int i = 0; i < count; i++)
        {
            string path = AssetDatabase.GUIDToAssetPath(guids[i]);
            AirshipScriptableObject so = AssetDatabase.LoadAssetAtPath<AirshipScriptableObject>(path);
            
            EditorUtility.DisplayProgressBar("Baking Meshes", $"Processing {so.name}...", (float)i / count);

            AirshipSerializedObject serObj = new AirshipSerializedObject(so);
            var texProp = serObj.FindAirshipProperty("ItemTexture");
            var thickProp = serObj.FindAirshipProperty("ItemThickness");

            if (texProp.objectReferenceValue is Texture2D tex)
            {
                string meshPath = $"{outDir}/{so.name}.asset";
                Mesh existingMesh = AssetDatabase.LoadAssetAtPath<Mesh>(meshPath);

                if (existingMesh != null)
                {
                    GenerateGridMesh(tex, thickProp.numberValue, existingMesh);
                    EditorUtility.SetDirty(existingMesh);
                }
                else
                {
                    Mesh newMesh = new Mesh();
                    GenerateGridMesh(tex, thickProp.numberValue, newMesh);
                    AssetDatabase.CreateAsset(newMesh, meshPath);
                }
            }
        }
        
        EditorUtility.ClearProgressBar();
        AssetDatabase.SaveAssets();
        AssetDatabase.Refresh();
    }

    class Rect { public int x0, x1, y0, y1; }

    struct VertKey
    {
        public Vector3 pos;
        public Vector3 norm;
        public VertKey(Vector3 p, Vector3 n) { pos = p; norm = n; }
    }

    static void GenerateGridMesh(Texture2D tex, float thickness, Mesh meshToUpdate)
    {
        int w = tex.width;
        int h = tex.height;
        float halfZ = thickness / 2f;
        Color32[] pixels = tex.GetPixels32();

        bool IsSolid(int x, int y) => x >= 0 && x < w && y >= 0 && y < h && pixels[y * w + x].a > 128;

        Dictionary<VertKey, int> vertMap = new Dictionary<VertKey, int>();
        List<Vector3> verts = new List<Vector3>();
        List<Vector2> uvs = new List<Vector2>();
        List<Vector3> normals = new List<Vector3>();
        List<int> tris = new List<int>();

        int GetOrAddVert(Vector3 pos, Vector3 normal)
        {
            Vector3 keyPos = new Vector3(
                Mathf.Round(pos.x * 1000f) / 1000f,
                Mathf.Round(pos.y * 1000f) / 1000f,
                Mathf.Round(pos.z * 1000f) / 1000f
            );

            VertKey key = new VertKey(keyPos, normal);
            if (vertMap.TryGetValue(key, out int index)) return index;

            index = verts.Count;
            vertMap[key] = index;
            verts.Add(pos);
            normals.Add(normal);
            uvs.Add(new Vector2((pos.x * PPU + w / 2f) / w, (pos.y * PPU + h / 2f) / h));
            return index;
        }

        void AddTri(Vector3 v1, Vector3 v2, Vector3 v3)
        {
            Vector3 normal = Vector3.Cross(v2 - v1, v3 - v1).normalized;
            normal = new Vector3(Mathf.Round(normal.x), Mathf.Round(normal.y), Mathf.Round(normal.z));

            int i1 = GetOrAddVert(v1, normal);
            int i2 = GetOrAddVert(v2, normal);
            int i3 = GetOrAddVert(v3, normal);

            if (i1 == i2 || i2 == i3 || i1 == i3) return;

            tris.Add(i1); tris.Add(i2); tris.Add(i3);
        }

        void AddQuad(Vector3 v1, Vector3 v2, Vector3 v3, Vector3 v4)
        {
            AddTri(v1, v2, v3);
            AddTri(v1, v3, v4);
        }

        Vector3 GetPos(float x, float y, float z) => new Vector3((x - w / 2f) / PPU, (y - h / 2f) / PPU, z);

        List<Rect> rects = new List<Rect>();
        bool[,] visited = new bool[w, h];

        for (int y = 0; y < h; y++)
        {
            for (int x = 0; x < w; x++)
            {
                if (IsSolid(x, y) && !visited[x, y])
                {
                    int x1 = x;
                    while (x1 < w && IsSolid(x1, y) && !visited[x1, y]) x1++;
                    int y1 = y + 1;
                    bool canExpand = true;
                    while (y1 < h && canExpand)
                    {
                        for (int tx = x; tx < x1; tx++) if (!IsSolid(tx, y1) || visited[tx, y1]) { canExpand = false; break; }
                        if (canExpand) y1++;
                    }
                    for (int ty = y; ty < y1; ty++) for (int tx = x; tx < x1; tx++) visited[tx, ty] = true;
                    rects.Add(new Rect { x0 = x, x1 = x1, y0 = y, y1 = y1 });
                }
            }
        }

        foreach (var R in rects)
        {
            HashSet<int> topX = new HashSet<int> { R.x0, R.x1 };
            HashSet<int> botX = new HashSet<int> { R.x0, R.x1 };
            HashSet<int> leftY = new HashSet<int> { R.y0, R.y1 };
            HashSet<int> rightY = new HashSet<int> { R.y0, R.y1 };

            foreach (var N in rects)
            {
                if (N == R) continue;
                if (N.y0 == R.y1 && N.x1 > R.x0 && N.x0 < R.x1) { if (N.x0 > R.x0) topX.Add(N.x0); if (N.x1 < R.x1) topX.Add(N.x1); }
                if (N.y1 == R.y0 && N.x1 > R.x0 && N.x0 < R.x1) { if (N.x0 > R.x0) botX.Add(N.x0); if (N.x1 < R.x1) botX.Add(N.x1); }
                if (N.x1 == R.x0 && N.y1 > R.y0 && N.y0 < R.y1) { if (N.y0 > R.y0) leftY.Add(N.y0); if (N.y1 < R.y1) leftY.Add(N.y1); }
                if (N.x0 == R.x1 && N.y1 > R.y0 && N.y0 < R.y1) { if (N.y0 > R.y0) rightY.Add(N.y0); if (N.y1 < R.y1) rightY.Add(N.y1); }
            }

            List<int> tX = new List<int>(topX); tX.Sort();
            List<int> bX = new List<int>(botX); bX.Sort();
            List<int> lY = new List<int>(leftY); lY.Sort();
            List<int> rY = new List<int>(rightY); rY.Sort();

            List<Vector2> perimeter = new List<Vector2>();
            for (int i = 0; i < bX.Count; i++) perimeter.Add(new Vector2(bX[i], R.y0));
            for (int i = 1; i < rY.Count; i++) perimeter.Add(new Vector2(R.x1, rY[i]));
            for (int i = tX.Count - 2; i >= 0; i--) perimeter.Add(new Vector2(tX[i], R.y1));
            for (int i = lY.Count - 2; i > 0; i--) perimeter.Add(new Vector2(R.x0, lY[i]));

            Vector2 C = new Vector2((R.x0 + R.x1) / 2f, (R.y0 + R.y1) / 2f);
            Vector3 c_f = GetPos(C.x, C.y, halfZ);
            Vector3 c_b = GetPos(C.x, C.y, -halfZ);

            for (int i = 0; i < perimeter.Count; i++)
            {
                Vector2 p1 = perimeter[i];
                Vector2 p2 = perimeter[(i + 1) % perimeter.Count];
                Vector3 f1 = GetPos(p1.x, p1.y, halfZ), f2 = GetPos(p2.x, p2.y, halfZ);
                Vector3 b1 = GetPos(p1.x, p1.y, -halfZ), b2 = GetPos(p2.x, p2.y, -halfZ);

                AddTri(c_f, f1, f2); AddTri(c_b, b2, b1);

                if (p1.y == p2.y && p1.y == R.y0 && p1.x < p2.x)
                {
                    if (R.y0 - 1 < 0 || !IsSolid(Mathf.FloorToInt((p1.x + p2.x) / 2f), R.y0 - 1)) AddQuad(f1, b1, b2, f2);
                }
                else if (p1.x == p2.x && p1.x == R.x1 && p1.y < p2.y)
                {
                    if (R.x1 >= w || !IsSolid(R.x1, Mathf.FloorToInt((p1.y + p2.y) / 2f))) AddQuad(f1, b1, b2, f2);
                }
                else if (p1.y == p2.y && p1.y == R.y1 && p1.x > p2.x)
                {
                    if (R.y1 >= h || !IsSolid(Mathf.FloorToInt((p1.x + p2.x) / 2f), R.y1)) AddQuad(f1, b1, b2, f2);
                }
                else if (p1.x == p2.x && p1.x == R.x0 && p1.y > p2.y)
                {
                    if (R.x0 - 1 < 0 || !IsSolid(R.x0 - 1, Mathf.FloorToInt((p1.y + p2.y) / 2f))) AddQuad(f1, b1, b2, f2);
                }
            }
        }

        meshToUpdate.Clear();
        meshToUpdate.indexFormat = UnityEngine.Rendering.IndexFormat.UInt32;
        meshToUpdate.SetVertices(verts);
        meshToUpdate.SetUVs(0, uvs);
        meshToUpdate.SetNormals(normals);
        meshToUpdate.SetTriangles(tris, 0);
        meshToUpdate.Optimize();
    }
}