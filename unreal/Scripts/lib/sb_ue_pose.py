"""Unreal-side: drives the knights' poses through a Level Sequence (Sequencer evaluates skeletal animation in the
editor world, where single-node animation does not tick), and re-grades the showcase lighting."""
import unreal

ES = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
AT = unreal.AssetToolsHelpers.get_asset_tools()
EAL = unreal.EditorAssetLibrary
KN = '/Game/SteelAndBlood/Characters/Player/HeroKnight/SK_HeroKnight/SkeletalMeshes/'
SEQ = '/Game/SteelAndBlood/Cinematics/LS_Showcase_Poses'

POSES = {'HeroKnight': ('A_Knight_Attack_Overhead', 0.30), 'Pose_0': ('A_Knight_Idle', 0.6), 'Pose_1': ('A_Knight_Walk', 0.3),
         'Pose_2': ('A_Knight_Attack_Overhead', 0.30), 'Pose_3': ('A_Knight_Attack_Overhead', 0.48), 'Pose_4': ('A_Knight_Block', 0.3),
         'Pose_5': ('A_Knight_HitReact', 0.1)}

def actors(): return {a.get_actor_label(): a for a in ES.get_all_level_actors()}

def reattach_weapons():
    """Move hand-attached weapons onto the new weapon_r socket."""
    A = actors(); n = 0
    for label, a in A.items():
        if '_SM_Wpn_' in label:
            owner = A.get(label.split('_SM_Wpn_')[0])
            if not owner: continue
            c = owner.skeletal_mesh_component
            a.attach_to_component(c, 'weapon_r', unreal.AttachmentRule.SNAP_TO_TARGET, unreal.AttachmentRule.SNAP_TO_TARGET, unreal.AttachmentRule.KEEP_RELATIVE, False)
            a.set_actor_relative_location(unreal.Vector(0, 0, 0), False, False); a.set_actor_relative_rotation(unreal.Rotator(0, 0, 0), False, False)
            n += 1
    return n

def build_sequence():
    if EAL.does_asset_exist(SEQ): EAL.delete_asset(SEQ)
    seq = AT.create_asset('LS_Showcase_Poses', '/Game/SteelAndBlood/Cinematics', unreal.LevelSequence, unreal.LevelSequenceFactoryNew())
    seq.set_display_rate(unreal.FrameRate(30, 1)); seq.set_playback_start(0); seq.set_playback_end(90)
    tick = seq.get_tick_resolution().numerator
    A = actors(); bound = []
    for label, (clip, t) in POSES.items():
        a = A.get(label)
        if not a: continue
        b = seq.add_possessable(a)
        tr = b.add_track(unreal.MovieSceneSkeletalAnimationTrack)
        sec = tr.add_section(); sec.set_range(0, 90)
        p = sec.get_editor_property('params')
        p.set_editor_property('animation', unreal.load_asset(KN + 'SK_HeroKnight' + clip))
        p.set_editor_property('first_loop_start_frame_offset', unreal.FrameNumber(int(t * tick)))
        p.set_editor_property('play_rate', 1.0)
        sec.set_editor_property('params', p)
        bound.append(label)
    EAL.save_asset(SEQ)
    unreal.LevelSequenceEditorBlueprintLibrary.open_level_sequence(seq)
    unreal.LevelSequenceEditorBlueprintLibrary.set_current_time(0)
    unreal.LevelSequenceEditorBlueprintLibrary.refresh_current_level_sequence()
    return bound

def regrade():
    A = actors(); out = []
    def sp(o, k, v):
        try: o.set_editor_property(k, v); out.append(k)
        except Exception as e: out.append('!' + k)
    if 'Sun_Dusk' in A: A['Sun_Dusk'].light_component.set_intensity(14.0)
    if 'SkyLight' in A: A['SkyLight'].light_component.set_intensity(2.2)
    if 'Moon_Rim' in A: A['Moon_Rim'].light_component.set_intensity(3.0)
    for k in ('BrazierLight_0', 'BrazierLight_1'):
        if k in A: A[k].light_component.set_intensity(90.0)
    if 'PostProcess_Grade' in A:
        ppv = A['PostProcess_Grade']; s = ppv.get_editor_property('settings')
        for k, v in (('auto_exposure_bias', 1.4), ('film_grain_intensity', 0.03), ('auto_exposure_min_brightness', 0.6), ('auto_exposure_max_brightness', 3.0)):
            sp(s, 'override_' + k, True); sp(s, k, v)
        ppv.set_editor_property('settings', s)
    unreal.get_editor_subsystem(unreal.LevelEditorSubsystem).save_current_level()
    return out

def hand_offsets():
    A = actors(); r = {}
    for label in ('HeroKnight', 'Pose_2', 'Pose_4'):
        a = A.get(label)
        if a:
            v = a.skeletal_mesh_component.get_socket_location('hand_r') - a.get_actor_location(); r[label] = [round(v.x), round(v.y), round(v.z)]
    return r
