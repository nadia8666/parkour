Shader "Unlit/BlockShader"
{
    Properties
    {
        _BaseMap ("Base Map", 2D) = "white" {}
    }
    SubShader
    {
        Tags 
        { 
            "RenderPipeline" = "UniversalPipeline"
            "RenderType" = "Opaque" 
            "Queue" = "Geometry" 
        }

        Pass
        {
            Name "ForwardLit"
            Tags { "LightMode" = "UniversalForward" }

            ZWrite On
            ZTest LEqual
            Cull Back

            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag

            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

            struct Attributes
            {
                float4 positionOS : POSITION;
                float3 normalOS   : NORMAL;
            };

            struct Varyings
            {
                float4 positionCS : SV_POSITION;
                float3 positionWS : TEXCOORD0;
                float3 normalWS   : TEXCOORD1;
                float3 positionOS : TEXCOORD3;
                float3 normalOS   : TEXCOORD4;
            };

            TEXTURE2D(_BaseMap);
            SAMPLER(sampler_BaseMap);
            TEXTURE3D(_Lightmap);
            SAMPLER(sampler_Lightmap);

            float4 _GridCenter;
            float4 _GridSize;
            float _VerticalOffset;

            CBUFFER_START(UnityPerMaterial)
                float4 _BaseMap_ST;
            CBUFFER_END

            Varyings vert(Attributes input)
            {
                Varyings output;
                output.positionWS = TransformObjectToWorld(input.positionOS.xyz);
                output.positionCS = TransformObjectToHClip(input.positionOS.xyz);
                output.normalWS = TransformObjectToWorldNormal(input.normalOS);
                output.positionOS = input.positionOS.xyz;
                output.normalOS = input.normalOS;
                return output;
            }

            float4 frag(Varyings input) : SV_Target
            {
                float3 triplanarPos = input.positionOS + _VerticalOffset;
                float3 localNormal = normalize(input.normalOS);
                float3 blend = abs(localNormal);
                blend /= (blend.x + blend.y + blend.z);

                float2 uvX = triplanarPos.zy * _BaseMap_ST.xy + _BaseMap_ST.zw;
                float2 uvY = triplanarPos.xz * _BaseMap_ST.xy + _BaseMap_ST.zw;
                float2 uvZ = triplanarPos.xy * _BaseMap_ST.xy + _BaseMap_ST.zw;

                float3 triplanar = SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, uvX).rgb * blend.x +
                                   SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, uvY).rgb * blend.y +
                                   SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, uvZ).rgb * blend.z;

                float3 normalWS = normalize(input.normalWS);
                float3 adjustedPos = input.positionWS + (normalWS * 0.5);
                float3 uvw = (adjustedPos - _GridCenter.xyz + (_GridSize.xyz/2)) / _GridSize.xyz;
                float light = SAMPLE_TEXTURE3D(_Lightmap, sampler_Lightmap, float3(uvw.x, floor(adjustedPos.y)/_GridSize.y, uvw.z)).r;

                return float4(triplanar * light, 1);
            }
            ENDHLSL
        }
    }
}