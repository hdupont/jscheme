jscheme = (function(){

    function remove_first_element(arr) {
        return arr.splice(0, 1)[0];
    }

    // Si arr = [["a", 1], ["b", 2], ["c", 3]]
    // Alors unzip(arr) vaut [["a", "b", "c"], [1, 2, 3]]
    function unzip(arr) {
        var arr1 = [];
        var arr2 = [];
        arr.forEach(function(pair) {
            arr1.push(pair[0]);
            arr2.push(pair[1]);
        });
        return [arr1, arr2];
    }

    function make_folder(fun, val) {
        return function(arr) {
            var res = val;
            arr.forEach(function(element) {
                res = fun(res, element);
            });
            return res;
        };
    }

    // Retourne un tableau contenant autant d'éléments (des tableaux) que 
    // d'expressions parsées : [[...], ..., [...]]
    // Chaque élément peut contenir des tableaux imbriqués.
    function parse(s) {

        function tokenize(s) {
            var current = '';
            tokens = [];
            for (var i = 0; i < s.length; i++) {
                var c = s[i];
                if (c === ' ' || c === '\n') {
                    if (current.length > 0) {
                        tokens.push(current);
                        current ='';
                    }
                }
                else if ( c === '(' || c === ')' ) {
                    if (current.length > 0) {
                        tokens.push(current);
                        current ='';
                    }
                    tokens.push(c);
                }
                else {
                    current = current + c;
                }
            }

            if (current.length > 0) {
                tokens.push(current);
            }

            return tokens;
        }

        function parse_tokens(tokens, inner) {

            var res = [];
            while (tokens.length > 0) {
                var current = remove_first_element(tokens);
                if (current === "(") {
                    res.push(parse_tokens(tokens, true));
                }
                else if (current === ")") {
                    if (inner) {
                        return res;
                    }
                    else {
                        throw new Error("Unmatched close paren: " + s);
                    }
                }
                else {
                    res.push(current);
                }
            }

            if (inner) {
                throw new Error("Unmatched open paren: " + s);
            }
            else {
                return res;
            }
        }

        return parse_tokens(tokenize(s), false);
    }

    var Environment = {
        create : function(parent) {
            var env = Object.create(null);
            env._parent = parent;
            env._frame = {};

            env.add_variable = function(name, value) {
                this._frame[name] = value;
            };

            env.lookup_variable = function(name) {
                if (typeof (this._frame)[name] !== "undefined") {
                    return this._frame[name];
                }
                else if (this._parent) {
                    return this._parent.lookup_variable(name);
                }
                else {
                    throw new Error('Undefined name: ' + name);
                }
            };

            return env;
        }
    };

    function create_global_env() {

        function primitive_plus(operands) {
            if (operands.length === 0) {
                return 0;
            }
            else {
                var sum = make_folder(function(x, y){return x + y;}, 0);
                return sum(operands);
            }
        }

        function primitive_minus(operands) {
            if (operands.length === 1) {
                return -1 * operands[0];
            }
            else if (operands.length === 2) {
                return operands[0] - operands[1];
            }
            else {
                throw new Error("- expects 1 or 2 operands, given " + operands.length);
            }
        }

        function primitive_times(operands) {
            if (operands.length === 0) {
                return 1;
            }
            else {
                var mul = make_folder(function(x,y){return x * y;}, 1);
                return mul(operands);
            }
        }

        function primitive_equals(operands) {
            check_operands(operands, 2, "=");
            return operands[0] === operands[1];
        }

        function primitive_less_than(operands) {
            check_operands(operands, 2, "<");
            return operands[0] < operands[1];
        }

        function primitive_cons(operands) {
            return [operands[0], operands[1]];
        }

        function primitive_car(operands) {
            return operands[0][0];
        }

        function primitive_cdr(operands) {
            return operands[0][1];
        }

        function primitive_display(operands) {
            return operands.join("");
        }

        function check_operands(operands, num, prim) {
            if (operands.length !== num) {
                throw new Error("Primitive " + prim + "expected " + num + "operands, given " + operands.length + " " + operands);
            }
        }

        var genv = Environment.create(null);
        genv.add_variable("+", primitive_plus);
        genv.add_variable("-", primitive_minus);
        genv.add_variable("*", primitive_times);
        genv.add_variable("=", primitive_equals);
        genv.add_variable("<", primitive_less_than);
        genv.add_variable("cons", primitive_cons);
        genv.add_variable("car", primitive_car);
        genv.add_variable("cdr", primitive_cdr);
        genv.add_variable("display", primitive_display);

        return genv;
    }

    function evaluate(expr, env) {

        var Procedure = {
            create : function(params, body, env) {
                var proc = Object.create(null);
                proc._params = params;
                proc._body = body;
                proc._env = env;

                proc.get_params = function() {
                    return this._params;
                };

                proc.get_body = function() {
                    return this._body;
                };

                proc.get_env = function() {
                    return this._env;
                };

                return proc;
            }
        };

        function is_number(expr) {
            if (Array.isArray(expr) ||  // c'est une expression de type (- x)
                expr[0] === '-' && expr.length === 1) {
                return false;
            }

            var digits = ['0','1','2','3','4','5','6','7','8','9'];
            if (expr[0] === '-' || digits.indexOf(expr[0]) !== -1) {
                // assert: commence par un signe moins ou par un chiffre.

                for (var i = 1; i < expr.length; i++) {
                   if (digits.indexOf(expr[i]) === -1) {
                    return false;
                   }
                }

                return true;
            }
            else {
                // assert: ne commence ni par un signe moins, ni par un chiffre.

                return false;
            }
        }

        function eval_number(expr) {
            return parseInt(expr, 10);
        }

        function is_string(expr) {
            return expr[0] === '"';
        }

        function eval_string(expr, env) {
            return expr.substr(1, expr.length - 2);
        }

        function is_name(expr) {
            return typeof expr === "string";
        }

        function eval_name(expr, env) {
            return env.lookup_variable(expr);
        }

        function is_application(expr) {
            return Array.isArray(expr);
        }

        function eval_application(expr, env) {

            // todo: se débarrasser de is_primitive_procedure
            function is_primitive_procedure(expr) {
                return Object.prototype.toString.call(expr) == '[object Function]';
            }

            function mapply(proc, operands) {
                if (is_primitive_procedure(proc)){
                    return proc(operands);
                }
                else { // todo: ajouter le test "isInstance"
                    var params = proc.get_params();
                    var new_env = Environment.create(proc.get_env());
                    if (params.length !== operands.length) {
                        throw new Error("Parameter length mismatch: " + operands.length);
                    }
                    params.forEach(function(param, index) {
                        new_env.add_variable(param, operands[index]);
                    });
                    var val = evaluate(proc.get_body(), new_env);
                    return val;
                }
            }

            var subexpr = expr;
            var subexpr_vals = [];
            subexpr.forEach(function(sexpr) {
                subexpr_vals.push(evaluate(sexpr, env));
            });

            var procedure = subexpr_vals[0];
            var operands = subexpr_vals.slice(1);
            return mapply(procedure, operands);
        }

        function is_special_form(expr, keyword) {
            return Array.isArray(expr) && expr.length > 0 && expr[0] === keyword;
        }

        function is_if(expr) {
            return is_special_form(expr, "if");
        }

        function eval_if(expr, env) {
            if (evaluate(expr[1], env) !== false) {
                return evaluate(expr[2], env);
            }
            else {
                return evaluate(expr[3], env);
            }
        }

        function is_let(expr) {
            return is_special_form(expr, "let");
        }

        function eval_let(expr, env) {
            // On construit une lambda
            var name_expr_pairs = unzip(expr[1]);
            var names = name_expr_pairs[0];
            var exprs = name_expr_pairs[1];
            var body = expr[2];

            var lambda_expr = ["lambda", names, body];
            var application_expr = [lambda_expr].concat(exprs);
            return eval_application(application_expr, env);
        }

        function is_function_definition(expr) {
            return is_special_form(expr, "define") && Array.isArray(expr[1]);
        }

        function eval_function_definition(expr, env) {
            // On construit un define avec une lambda
            var name = expr[1][0];
            var args = expr[1].slice(1);
            var body = expr[2];
            var new_expr = ["define", name, ["lambda", args, body]];
            return eval_definition(new_expr, env);
        }

        function is_definition(expr) {
            return is_special_form(expr, "define");
        }

        function eval_definition(expr, env) {
            var name = expr[1];
            var value = evaluate(expr[2], env);
            env.add_variable(name, value);
        }

        function is_lambda(expr) {
            return is_special_form(expr, "lambda");
        }

        function eval_lambda(expr, env) {
            return Procedure.create(expr[1], expr[2], env);
        }

        if (is_string(expr)) {
            return eval_string(expr);
        }
        if (is_number(expr)) {
            return eval_number(expr);
        }
        else if (is_if(expr)) {
            return eval_if(expr, env);
        }
        else if (is_let(expr)) {
            return eval_let(expr, env);
        }
        else if (is_function_definition(expr)) {
            return eval_function_definition(expr, env);
        }
        else if (is_definition(expr)) {
            return eval_definition(expr, env);
        }
        else if (is_name(expr)) {
            return eval_name(expr, env);
        }
        else if (is_lambda(expr)) {
            return eval_lambda(expr, env);
        }
        else if (is_application(expr)) {
            return eval_application(expr, env);
        }
        else {
            throw new Error ('Unknown expression type: ' + expr);
        }
    }

    return {

        eval_str : function(str) {
            var genv = create_global_env();
            var expressions = parse(str);
            var values = expressions.map(function(expr) {
                return evaluate(expr, genv);
            });
            return values;
        }

    };
})();
