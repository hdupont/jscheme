'''
Code source de Charme, un interpréteur de Scheme écrit par David Evans
dans son livre Introduction to Computing Explorations in Language, Logic,
and Machines
http://www.computingbook.org/
'''


def tokenize(s):
    current = ''                        # initialize current to the empty string
    tokens = []                         # initialize tokens to the empty list
    for c in s:                         # for each character, c, in the string s
        if c.isspace():                 # if c is a whitespace
            if len(current) > 0:        # if the current token is non-empty
                tokens.append(current)  # add it to the list
                current = ''            # reset current token to empty string
        elif c in '()':                 # otherwise, if c is a parenthesis
            if len(current) > 0:        # end the current token
                tokens.append(current)  # add it to the tokens list
                current = ''            # and reset current to the empty string
            tokens.append(c)            # add the parenthesis to the token list
        else:                           # otherwise (it is an alphanumeric)
            current = current + c       # add the character to the current token
    # end of the for loop reached the end of s

    if len(current) > 0:                # if there is a current token
        tokens.append(current)          # add it to the token list
    return tokens                       # the result is the list of tokens


def parse(s):
    def parse_tokens(tokens, inner):
        res = []
        while len(tokens) > 0:
            current = tokens.pop(0)
            if current == '(':
                res.append(parse_tokens(tokens, True))
            elif current == ')':
                if inner:
                    return res
                else:
                    raise NameError('Unmatched close paren: ' + s)
                    return None
            else:
                res.append(current)

        if inner:
            raise NameError('Unmatched open paren: ' + s)
            return None
        else:
            return res

    return parse_tokens(tokenize(s), False)


def meval(expr, env):
    if is_primitive(expr):
        return eval_primitive(expr)
    elif is_if(expr):
        return eval_if(expr, env)
    elif is_definition(expr):
        eval_definition(expr, env)
    elif is_name(expr):
        return eval_name(expr, env)
    elif is_lambda(expr):
        return eval_lambda(expr, env)
    elif is_application(expr):
        return eval_application(expr, env)
    else:
        raise NameError('Unknown expression type: ' + str(expr))


def is_primitive(expr):
    return is_number(expr) or is_primitive_procedure(expr)


def is_number(expr):
    return isinstance(expr, str) and expr.isdigit()


def is_primitive_procedure(expr):
    return callable(expr)


def eval_primitive(expr):
    if is_number(expr):
        return int(expr)
    else:
        return expr


def primitive_plus(operands):
    if (len(operands) == 0):
        return 0
    else:
        return operands[0] + primitive_plus(operands[1:])


def primitive_times(operands):
    if (len(operands) == 0):
        return 1
    else:
        return operands[0] * primitive_times(operands[1:])


def primitive_minus(operands):
    if (len(operands) == 1):
        return -1 * operands[0]
    elif (len(operands) == 2):
        return operands[0] - operands[1]
    else:
        raise NameError('- expectes 1 or 2 operands')


def primitive_equals(operands):
    check_operands(operands, 2, '=')
    return operands[0] == operands[1]


def primitive_lessthan(operands):
    check_operands(operands, 2, '<')
    return operands[0] < operands[1]


def check_operands(operands, num, prim):
    if (len(operands) != num):
        raise NameError('Primitive %s expected %s operands')


def is_special_form(expr, keyword):
    return isinstance(expr, list) and len(expr) > 0 and expr[0] == keyword


def is_if(expr):
    return is_special_form(expr, 'if')


def eval_if(expr, env):
    if meval(expr[1], env) is not False:
        return meval(expr[2], env)
    else:
        return meval(expr[3], env)


class Environment:
    def __init__(self, parent):
        self._parent = parent
        self._frame = {}

    def add_variable(self, name, value):
        self._frame[name] = value

    def lookup_variable(self, name):
        if self._frame.has_key(name):
            return self._frame[name]
        elif (self._parent):
            return self._parent.lookup_variable(name)
        else:
            raise NameError('Undefined name: %s' % (name))


def is_definition(expr):
    return is_special_form(expr, 'define')


def eval_definition(expr, env):
    name = expr[1]
    value = meval(expr[2], env)
    env.add_variable(name, value)


def is_name(expr):
    return isinstance(expr, str)


def eval_name(expr, env):
    return env.lookup_variable(expr)


class Procedure:
    def __init__(self, params, body, env):
        self._params = params
        self._body = body
        self._env = env

    def getParams(self):
        return self._params

    def getBody(self):
        return self._body

    def getEnvironment(self):
        return self._env


def is_lambda(expr):
    return is_special_form(expr, 'lambda')


def eval_lambda(expr, env):
    return Procedure(expr[1], expr[2], env)


def is_application(expr):  # requires: all special forms checked first
    return isinstance(expr, list)


def eval_application(expr, env):
    subexprs = expr
    subexprvals = map(lambda sexpr: meval(sexpr, env), subexprs)
    return mapply(subexprvals[0], subexprvals[1:])


def mapply(proc, operands):
    if (is_primitive_procedure(proc)):
        return proc(operands)
    elif isinstance(proc, Procedure):
        params = proc.getParams()
        newenv = Environment(proc.getEnvironment())
        if len(params) != len(operands):
            raise NameError('Parameter length mismatch: %s given operands %s' % (str(proc), str(operands)))
        for i in range(0, len(params)):
            newenv.add_variable(params[i], operands[i])
        return meval(proc.getBody(), newenv)
    else:
        raise NameError('Application of non-procedure')


def evalLoop():
    genv = Environment(None)
    genv.add_variable('true', True)
    genv.add_variable('false', False)
    genv.add_variable('+', primitive_plus)
    genv.add_variable('-', primitive_minus)
    genv.add_variable('*', primitive_times)
    genv.add_variable('=', primitive_equals)
    genv.add_variable('<', primitive_lessthan)
    while True:
        inv = raw_input('Charme> ')
        if inv == 'quit':
            break
        for expr in parse(inv):
            print(meval(expr, genv))

if __name__ == '__main__':
    evalLoop()
