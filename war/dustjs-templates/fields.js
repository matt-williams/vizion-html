(function(){dust.register("float_vec2",body_0);function body_0(chk,ctx){return chk.write("<div class=\"vector\"><input id=\"input_float_vec2_").reference(ctx.getPath(false,["input","name"]),ctx,"h").write("[").reference(ctx.get("index"),ctx,"h").write("]_0\" type=\"text\" value=\"").reference(ctx.getPath(false,["value","0"]),ctx,"h").write("\" title=\"x/r\"></input><input id=\"input_float_vec2_").reference(ctx.getPath(false,["input","name"]),ctx,"h").write("[").reference(ctx.get("index"),ctx,"h").write("]_1\" type=\"text\" value=\"").reference(ctx.getPath(false,["value","1"]),ctx,"h").write("\" title=\"y/g\"></input></div>");}return body_0;})();(function(){dust.register("label",body_0);function body_0(chk,ctx){return chk.write("<h3>").reference(ctx.getPath(false,["input","name"]),ctx,"h").write(" (").reference(ctx.getPath(false,["input","type"]),ctx,"h").write("[").reference(ctx.getPath(false,["input","size"]),ctx,"h").write("])</h3>");}return body_0;})();