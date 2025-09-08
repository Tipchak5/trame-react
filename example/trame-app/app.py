from trame.app import get_server
from trame.ui.vuetify3 import SinglePageLayout
from trame.widgets import iframe, vuetify3 as vuetify, vtk as vtk_widgets

from vtkmodules.vtkIOImage import vtkPNGReader
from vtkmodules.vtkFiltersSources import vtkConeSource
from vtkmodules.vtkRenderingCore import (
    vtkTexture,
    vtkRenderer,
    vtkRenderWindow,
    vtkRenderWindowInteractor,
    vtkPolyDataMapper,
    vtkActor,
)
from vtkmodules.vtkInteractionStyle import vtkInteractorStyleSwitch 

### Setup some VTK pipeline
renderer = vtkRenderer()
renderWindow = vtkRenderWindow()
renderWindow.AddRenderer(renderer)

renderWindowInteractor = vtkRenderWindowInteractor()
renderWindowInteractor.SetRenderWindow(renderWindow)
renderWindowInteractor.GetInteractorStyle().SetCurrentStyleToTrackballCamera()


image_path = 'bg.png'
reader = vtkPNGReader()
reader.SetFileName(image_path)
reader.Update()

# 创建纹理并设置为渲染器的背景
texture = vtkTexture()
texture.SetInputConnection(reader.GetOutputPort())
texture.InterpolateOn()

# 应用纹理到渲染器背景
renderer.SetBackgroundTexture(texture)
renderer.InteractiveOn()

cone_source = vtkConeSource()
mapper = vtkPolyDataMapper()
actor = vtkActor()
mapper.SetInputConnection(cone_source.GetOutputPort())
actor.SetMapper(mapper)
renderer.AddActor(actor)
renderer.ResetCamera()
renderWindow.Render()

server = get_server(client_type="vue3")

state, ctrl = server.state, server.controller
state.trame__title = ""

state.testKey = "1"
state.timestamp = "22"
state.testData = "测试"

state.interaction_mode = "interact"
state.selection_updated = True
state.interactor_settings = []

DEFAULT_RESOLUTION = 6

VIEW_INTERACT = [
    {"button": 1, "action": "Rotate"},
    {"button": 2, "action": "Pan"},
    {"button": 3, "action": "Zoom", "scrollEnabled": True},
    {"button": 1, "action": "Pan", "alt": True},
    {"button": 1, "action": "Zoom", "control": True},
    {"button": 1, "action": "Pan", "shift": True},
    {"button": 1, "action": "Roll", "alt": True, "shift": True},
]

VIEW_SELECT = [{"button": 1, "action": "Select"}]

@state.change("interaction_mode")
def update_picking_mode(interaction_mode, **kwargs):
    print(f"state change - updating interaction mode: {interaction_mode}")

    if interaction_mode == "interact":
        state.update(
            {
                "interactor_settings": VIEW_INTERACT,
            }
        )
    else:
        state.interactor_settings = VIEW_SELECT if interaction_mode == "select" else VIEW_INTERACT
    state.flush()   

@ctrl.trigger("get_number_of_cells")
def get_number_of_cells():
    cone = cone_source.GetOutput() 
    return cone.GetNumberOfCells()

@ctrl.trigger("raise_error")
def raise_error():
    raise RuntimeError("I'm not doing this")
   
@state.change("resolution")
def update_cone(resolution, **kwargs):
    print(f"state change - updating resolution to {resolution}")
    cone_source.SetResolution(resolution)
    ctrl.view_update()

@ctrl.trigger("reset_resolution")           
def reset_resolution():
    state.resolution = DEFAULT_RESOLUTION

# 获取前端传递的数据testKey
# @state.change("testKey","timestamp")
# def on_test_key_change(testKey,timestamp, **kwargs):
#     print(f"state 接收前端数据1 - testKey: {testKey},timestamp: {timestamp}")

@state.change("timestamp")
def on_test_key_change(timestamp, **kwargs):
    print(f"state 前端数据1 timestamp: {timestamp}")

# 前端数据2
# @ctrl.trigger("process_data")
# def process_data(**kwargs):
#     print(f"Triggered 前端数据2: {kwargs}")
#     return {"status": "received", "data": kwargs}

@ctrl.trigger("process_data")
def process_data(data):
    print(f"Triggered 前端数据2: {data}")
    return {"status": "received", "data": data}

# 模拟状态更新
@ctrl.trigger("update_data")
def update_data():
    state.testData = "传数据给前端:1111"

# 前端通过操作 获取数据
@ctrl.trigger("fetch_data")
def fetch_data():
    return {"key": "value", "anotherKey": 123}


# -----------------------------------------------------------------------------

with SinglePageLayout(server) as layout:
    layout.footer = None 
    layout.icon.click = ctrl.view_reset_camera
    ctrl.trigger("reset_camera")(ctrl.view_reset_camera)
    layout.title.set_text("") # 设置标题
   

    # with layout.toolbar:
    #     vuetify.VSpacer()
    #     vuetify.VSlider(
    #         v_model=("resolution", DEFAULT_RESOLUTION),
    #         min=3,
    #         max=60,
    #         step=1,
    #         hide_details=True,
    #         dense=True,
    #         style="max-width: 300px",
    #     )
    #     vuetify.VDivider(vertical=True, classes="mx-2")

    #     # vuetify.VBtn("Send data", click=process_data)

    #     with vuetify.VBtn(icon=True, click=reset_resolution):
    #         vuetify.VIcon("mdi-undo-variant")

    with layout.content:
        iframe.Communicator(target_origin="http://localhost:3000", enable_rpc=True)

        html_view = vtk_widgets.VtkLocalView(
            renderWindow,
            interactor_settings=("interactor_settings",)
        )
        ctrl.view_reset_camera = html_view.reset_camera
        ctrl.view_update = html_view.update

if __name__ == "__main__":
    server.start()
