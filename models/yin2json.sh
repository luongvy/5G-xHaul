#!/bin/bash

################################################################################
# Script to convert yang modules into other formats
# Author: martin.skorupski@highstreet-technologies.com
# 
# Copyright 2018 higshtreet technologies GmbH
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
# 
#     http://www.apache.org/licenses/LICENSE-2.0
# 
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
# 

yins="./yin";
mkdir -f "./json";

function filename {
    x=${1%.*}
    y=${x/$yins/\.\/$2}
    echo $y"."$2;
}  

function convert {
    FILENAME=$(filename $1 $2);
    # xslt
}  

for yin in $yins/*.yin; do
    echo "convert file: "$yin;
    $(convert $yang "json");
    echo "done!";
    echo;
done
