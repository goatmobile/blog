import apylaas
import classifier
import io
from PIL import Image

# How to render the type in an input element in the HTML
# - You can put arbitrary HTML here, but if it's just a word then 'apylaas' wraps
#   it with an <input> element.
def image_html(type):
    if type == Image:
        return "file"

    return None


# How to take the bytes from the page and turn them into a Python type
def image_loader_wrapper(type):
    # Check if the type is something supported
    if type == Image:

        def image_loader(f):
            # Read the file-like f into a PIL.Image
            return Image.open(io.BytesIO(f.read()))

        return image_loader
    return None


app = apylaas.App(
    module=classifier, input_to_python=[image_loader_wrapper], type_to_html=[image_html]
)
app.serve()
