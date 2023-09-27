// Copyright 2023 Amazon Web Services, Inc
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// 
//     http://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import ExpandableSection from '@awsui/components-react/expandable-section';
import Checkbox from '@awsui/components-react/checkbox';
import Box from '@awsui/components-react/box';
import "../../index.css";

const Hierarchy = ({ options, resource, onSelect, handleToggle, action, allItems }) => {
  return (
    <div>
      <ul>
        {options.map(option => (
          <li key={option.Id}>
            {(option.Children.length === 0) ? (
              <li>
                <Checkbox
                  onChange={({ detail }) => {
                    handleToggle(option, detail.checked)
                  }}
                  checked={resource.some(item => item.value === option.Id)}
                  disabled={action ? allItems.some(item => item.id === options.Id) : false}
                >
                  <div>
                    <Box>{option.Name}</Box>
                    <Box variant="awsui-key-label">{option.Id}</Box>
                  </div>
                </Checkbox>
              </li>
            ) : (
              <li>
                <ExpandableSection
                  variant="footer"
                  header={
                    <>
                      <Checkbox
                        onChange={({ detail }) => {
                          handleToggle(option, detail.checked)
                        }}
                        checked={resource.some(item => item.value === option.Id)}
                        disabled={action ? allItems.some(item => item.id === options.Id) : false}
                      >

                          <div>
                            <Box>{option.Name}</Box>
                            <Box variant="awsui-key-label">{option.Id}</Box>
                          </div>
                        </Checkbox>
                      </>
                    }
                  >
                    <Hierarchy
                      options={option.Children}
                      resource={resource}
                      onSelect={onSelect}
                      handleToggle={handleToggle}
                    />
                  </ExpandableSection>
              </li>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Ous({ options, setResource, resource = [], action = null, allItems = [] }) {
  const handleSelect = (selected) => {
    setResource(selected)
  };

  const handleToggle = (value, checked) => {
    const data = { label: value.Name, value: value.Id }
    if (checked) {
      handleSelect([...resource, data]);
    } else {
      handleSelect(resource.filter(option => option.value !== data.value));
    }
  };
  ;

  return (
    <ExpandableSection
      variant="footer"
      header={
        <div>
          <Checkbox
            onChange={({ detail }) => {
              handleToggle(options[0], detail.checked)
            }}
            checked={resource.some(item => item.value === options[0].Id)}
            disabled={action ? allItems.some(item => item.id === options[0].Id) : false}
          >
            <div>
              <Box>{options[0].Name}</Box>
              <Box variant="awsui-key-label">{options[0].Id}</Box>
            </div>
          </Checkbox>
        </div>
      }
    >
      <Hierarchy
        options={options[0].Children}
        resource={resource}
        onSelect={handleSelect}
        handleToggle={handleToggle}
        action={action}
        allItems={allItems}
      />
    </ExpandableSection>
  );
};

export default Ous;